import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// ====== CONFIG ======
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Your deployed site base URL (used only for displaying an example link)
const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin + "/").replace(/\/?$/, "/");

// LocalStorage keys
const LS_ACTIVE_SOCIETY = "active_society_id";

// Lazy-load the main App so AuthGate stays lightweight
const AppLazy = React.lazy(() => import("./App.jsx"));

// ====== UI Helpers ======
function CenterCard({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.06),transparent_55%),radial-gradient(circle_at_bottom,rgba(0,0,0,0.06),transparent_55%)]">
      <div className="w-[min(520px,92vw)] rounded-3xl border border-neutral-200 bg-white/80 backdrop-blur p-6 shadow-[0_20px_80px_rgba(0,0,0,0.08)]">
        {children}
      </div>
    </div>
  );
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ====== MAIN COMPONENT ======
export default function AuthGate() {
  // Create Supabase client once
  const client = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
      return null;
    }
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }, []);

  // Determine “public society slug” from URL
  const pathSlug = useMemo(() => {
    const p = window.location.pathname.replace(/^\/+/, "").split("/")[0] || "";
    return p.trim();
  }, []);

  // Auth state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Magic link
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Tenant state (for logged-in)
  const [tenantLoading, setTenantLoading] = useState(false);
  const [memberships, setMemberships] = useState([]); // {society_id, role, ...}
  const [societies, setSocieties] = useState([]); // safe subset
  const [activeSocietyId, setActiveSocietyId] = useState(null);

  // UI mode for “no memberships” flow
  const [createMode, setCreateMode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newSocietyName, setNewSocietyName] = useState("");
  const [newSocietySlug, setNewSocietySlug] = useState("");
  const [creating, setCreating] = useState(false);

  // Society picker
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---- Init auth
  useEffect(() => {
    if (!client) return;
    let mounted = true;

    (async () => {
      setAuthLoading(true);
      const { data } = await client.auth.getSession();
      if (!mounted) return;
      setSession(data.session || null);
      setAuthLoading(false);
    })();

    const { data: sub } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [client]);

  // ---- Fetch memberships + societies when logged in
  useEffect(() => {
    if (!client || !session?.user?.id) return;

    let cancelled = false;

    const load = async () => {
      setTenantLoading(true);
      setMsg("");

      // 1) memberships for this user
      const { data: mem, error: memErr } = await client
        .from("memberships")
        .select("society_id,role,created_at")
        .eq("user_id", session.user.id);

      if (cancelled) return;

      if (memErr) {
        console.error(memErr);
        setMsg(memErr.message || "Failed to load memberships");
        setMemberships([]);
        setSocieties([]);
        setActiveSocietyId(null);
        setTenantLoading(false);
        return;
      }

      const memRows = Array.isArray(mem) ? mem : [];
      setMemberships(memRows);

      const societyIds = memRows.map((m) => m.society_id).filter(Boolean);

      if (societyIds.length === 0) {
        setSocieties([]);
        setActiveSocietyId(null);
        setTenantLoading(false);
        return;
      }

      // 2) safe select societies (no internals)
      const { data: soc, error: socErr } = await client
        .from("societies")
        .select("id,name,slug,viewer_enabled")
        .in("id", societyIds);

      if (cancelled) return;

      if (socErr) {
        console.error(socErr);
        setMsg(socErr.message || "Failed to load societies");
        setSocieties([]);
        setActiveSocietyId(null);
        setTenantLoading(false);
        return;
      }

      const socRows = Array.isArray(soc) ? soc : [];
      setSocieties(socRows);

      // 3) pick active society:
      //    Prefer URL slug if it matches a membership society slug
      let preferredId = null;

      if (pathSlug) {
        const match = socRows.find((s) => String(s.slug || "").toLowerCase() === String(pathSlug).toLowerCase());
        if (match) preferredId = String(match.id);
      }

      // fallback: localStorage
      if (!preferredId) {
        try {
          const stored = localStorage.getItem(LS_ACTIVE_SOCIETY);
          if (stored && societyIds.map(String).includes(String(stored))) {
            preferredId = String(stored);
          }
        } catch {}
      }

      // fallback: first society
      if (!preferredId) preferredId = String(societyIds[0]);

      setActiveSocietyId(preferredId);

      // If user has more than one society, open picker once if URL slug didn't decide it
      if (!pathSlug && socRows.length > 1) setPickerOpen(true);

      setTenantLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [client, session?.user?.id, pathSlug]);

  const signOut = async () => {
    setMsg("");
    try {
      await client.auth.signOut();
    } catch (e) {
      console.error(e);
    }
  };

  const sendMagicLink = async (e) => {
    e.preventDefault();
    if (!client) return;
    setMsg("");
    setBusy(true);

    try {
      const redirectTo = window.location.origin + "/" + (pathSlug ? pathSlug + "/" : "");
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setMsg("Check your email for the magic link.");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Failed to send magic link");
    } finally {
      setBusy(false);
    }
  };

  const createSociety = async (e) => {
    e.preventDefault();
    if (!client || !session?.user?.id) return;

    setMsg("");
    setCreating(true);

    try {
      // Validate invite code
      const code = String(inviteCode || "").trim();
      if (!code) throw new Error("Invite code is required");

      const { data: codeRow, error: codeErr } = await client
        .from("invite_codes")
        .select("code,is_active,max_uses,uses")
        .eq("code", code)
        .maybeSingle();

      if (codeErr) throw codeErr;
      if (!codeRow) throw new Error("Invalid invite code");
      if (codeRow.is_active === false) throw new Error("Invite code is inactive");

      const uses = Number(codeRow.uses || 0);
      const maxUses = Number(codeRow.max_uses || 0);
      if (maxUses > 0 && uses >= maxUses) throw new Error("Invite code has reached max uses");

      const name = String(newSocietyName || "").trim();
      if (!name) throw new Error("Society name is required");

      let slug = slugify(newSocietySlug || name);
      if (!slug) slug = "society";

      // Create society (server-side RLS should allow only for users with invite code)
      const { data: created, error: socErr } = await client
        .from("societies")
        .insert({
          name,
          slug,
          // optionally store invite code usage metadata if your schema supports it
        })
        .select("id,name,slug,viewer_enabled")
        .single();

      if (socErr) throw socErr;

      // Add membership as captain for creator
      const { error: memErr } = await client.from("memberships").insert({
        society_id: created.id,
        user_id: session.user.id,
        role: "captain",
      });
      if (memErr) throw memErr;

      // Increment invite code uses (optional; if schema supports)
      await client
        .from("invite_codes")
        .update({ uses: uses + 1 })
        .eq("code", code);

      setMsg("Society created. Redirecting…");

      // Store and go
      setActiveSocietyId(String(created.id));
      try {
        localStorage.setItem(LS_ACTIVE_SOCIETY, String(created.id));
      } catch {}
      setCreateMode(false);

      // Navigate to slug route
      if (created.slug) {
        window.location.assign(window.location.origin + "/" + created.slug);
      }
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Failed to create society");
    } finally {
      setCreating(false);
    }
  };

  // ====== RENDER ======
  if (!client) {
    return (
      <CenterCard>
        <div className="text-xl font-black">Config error</div>
        <div className="text-sm text-neutral-600 mt-2">
          Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.
        </div>
      </CenterCard>
    );
  }

  if (authLoading) {
    return (
      <CenterCard>
        <div className="text-sm text-neutral-600">Loading…</div>
      </CenterCard>
    );
  }

  // Not logged in => public landing + magic link
  if (!session) {
    return (
      <CenterCard>
        <div className="text-2xl font-black text-neutral-900">Sign in</div>
        <div className="text-sm text-neutral-600 mt-2">We’ll email you a magic link.</div>

        <form className="mt-5 space-y-3" onSubmit={sendMagicLink}>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Email</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          {msg ? (
            <div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">
              {msg}
            </div>
          ) : null}

          <button
            className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Sending…" : "Send magic link"}
          </button>

          <div className="text-xs text-neutral-500 pt-1">
            Golfers: use your society link (e.g. <span className="font-mono">{SITE_URL}den</span>).
          </div>
        </form>
      </CenterCard>
    );
  }

  // Logged-in modes below (captains/admins)

  if (tenantLoading) {
    return (
      <CenterCard>
        <div className="text-sm text-neutral-600">Loading…</div>
        <button
          className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={signOut}
        >
          Sign out
        </button>
      </CenterCard>
    );
  }

  if (memberships.length === 0) {
    if (!createMode) {
      return (
        <CenterCard>
          <div className="text-lg font-black text-neutral-900">{session.user.email}</div>
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You don’t have access to any societies yet.
          </div>

          <button
            className="mt-4 w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold"
            onClick={() => {
              setMsg("");
              setCreateMode(true);
            }}
          >
            Create a new society
          </button>

          <button
            className="mt-3 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={signOut}
          >
            Sign out
          </button>
        </CenterCard>
      );
    }

    return (
      <CenterCard>
        <div className="text-2xl font-black text-neutral-900">Create society</div>
        <div className="text-sm text-neutral-600 mt-2">
          Enter your invite code and name your society.
        </div>

        <form className="mt-4 space-y-3" onSubmit={createSociety}>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Invite code</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="e.g. CHART-7F3KQ"
              autoCapitalize="characters"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Society name</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={newSocietyName}
              onChange={(e) => setNewSocietyName(e.target.value)}
              placeholder="e.g. Den Society"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Slug (optional)</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={newSocietySlug}
              onChange={(e) => setNewSocietySlug(e.target.value)}
              placeholder="e.g. den-society"
            />
            <div className="text-xs text-neutral-500 mt-1">
              Used for friendly URLs. Leave blank to auto-generate.
            </div>
          </div>

          {msg ? (
            <div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">
              {msg}
            </div>
          ) : null}

          <button
            className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create society"}
          </button>

          <button
            type="button"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={() => {
              setMsg("");
              setCreateMode(false);
            }}
          >
            Back
          </button>

          <button
            type="button"
            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={signOut}
          >
            Sign out
          </button>
        </form>
      </CenterCard>
    );
  }

  const options = (societies || [])
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (pickerOpen) {
    return (
      <CenterCard>
        <div className="text-xs font-black tracking-widest uppercase text-neutral-400">
          Choose society
        </div>
        <div className="text-lg font-black text-neutral-900 mt-1">{session.user.email}</div>

        <div className="mt-4 space-y-2">
          {options.map((s) => (
            <button
              key={s.id}
              className="w-full text-left rounded-2xl border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50"
              onClick={() => {
                const id = String(s.id);
                setActiveSocietyId(id);
                try {
                  localStorage.setItem(LS_ACTIVE_SOCIETY, id);
                } catch {}
                setPickerOpen(false);
              }}
            >
              <div className="font-black text-neutral-900">{s.name || s.slug || s.id}</div>
              <div className="text-xs text-neutral-500">{s.slug ? `/${s.slug}` : s.id}</div>
            </button>
          ))}
        </div>

        <button
          className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={signOut}
        >
          Sign out
        </button>
      </CenterCard>
    );
  }

  const activeSoc = options.find((s) => String(s.id) === String(activeSocietyId));
  const role =
    memberships.find((m) => String(m.society_id) === String(activeSocietyId))?.role || "player";

  return (
    <React.Suspense fallback={<CenterCard><div>Loading…</div></CenterCard>}>
      <AppLazy
        key={String(activeSocietyId)}
        supabase={client}
        session={session}
        activeSocietyId={String(activeSocietyId)}
        activeSocietySlug={activeSoc?.slug || ""}
        activeSocietyName={activeSoc?.name || ""}
        activeSocietyRole={role}
      />
    </React.Suspense>
  );
}
