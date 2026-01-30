import React from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const LS_ACTIVE_SOCIETY = "den_active_society_id_v1";

// GitHub Pages base (repo name)
const GH_PAGES_BASE = "/golf/";
const SITE_ORIGIN = "https://kevanojb.github.io";
const SITE_URL = `${SITE_ORIGIN}${GH_PAGES_BASE}`;

const AppLazy = React.lazy(() => import("./App.jsx"));

function CenterCard({ children }) {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isOnboardForced() {
  try {
    const sp = new URLSearchParams(window.location.search || "");
    return sp.get("onboard") === "1";
  } catch {
    return false;
  }
}

// For GH Pages, pathname includes the repo base path.
// Example: "/golf/den" => slug "den"
function getSlugFromPath() {
  try {
    if (isOnboardForced()) return "";
    let path = window.location.pathname || "/";
    if (path === GH_PAGES_BASE.slice(0, -1)) path = GH_PAGES_BASE; // "/golf" -> "/golf/"
    const clean = path.startsWith(GH_PAGES_BASE)
      ? path.slice(GH_PAGES_BASE.length)
      : path.replace(/^\//, "");
    return (clean.split("/").filter(Boolean)[0] || "").trim();
  } catch {
    return "";
  }
}

function FloatingAdminButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 left-4 z-50 rounded-full px-4 py-2 shadow-lg border border-neutral-200 bg-white text-neutral-900 font-bold"
      title="Admin sign in"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      Admin sign in
    </button>
  );
}

function AdminSignInSheet({ open, onClose, email, setEmail, busy, msg, onSubmit }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-neutral-900">Admin sign in</div>
            <div className="text-xs text-neutral-500">We’ll email you a magic link.</div>
          </div>
          <button
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 font-bold"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
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
            <div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">{msg}</div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Sending…" : "Send magic link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PostLoginChoiceCard({ email, captainSocieties, onCreateSociety, onCreateSeason, onCancel, pending }) {
  return (
    <CenterCard>
      <div className="text-xs font-black tracking-widest uppercase text-neutral-400">Welcome back</div>
      <div className="text-lg font-black text-neutral-900 mt-1">{email}</div>

      <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
        You already belong to existing societies. What would you like to do?
      </div>

      <div className="mt-4 space-y-2">
        <button className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold" onClick={onCreateSociety}>
          Create a new society
        </button>

        <button
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={onCreateSeason}
        >
          Create a new season/competition in an existing society
        </button>

        <button
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 text-xs text-neutral-500">
        Pending setup: <span className="font-mono">{pending?.society_name || ""}</span>
        {pending?.first_season_name ? <> · <span className="font-mono">{pending.first_season_name}</span></> : null}
      </div>

      {(!captainSocieties || captainSocieties.length === 0) ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You’re not a captain of any existing society, so “Create season” won’t be available.
        </div>
      ) : null}
    </CenterCard>
  );
}

function CreateSeasonCard({ email, societies, societyId, setSocietyId, label, setLabel, msg, busy, onCreate, onBack }) {
  return (
    <CenterCard>
      <div className="text-2xl font-black text-neutral-900">Create season</div>
      <div className="text-sm text-neutral-600 mt-2">Choose a society and enter a season/competition label.</div>
      <div className="mt-3 text-xs text-neutral-500">{email}</div>

      <form className="mt-4 space-y-3" onSubmit={onCreate}>
        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">Society</label>
          <select
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
            value={societyId}
            onChange={(e) => setSocietyId(e.target.value)}
          >
            <option value="">Select…</option>
            {(societies || []).map((s) => (
              <option key={s.id} value={String(s.id)}>{s.name || s.slug || s.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-neutral-700 mb-1">Season / Competition</label>
          <input
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. 2026, Winter 25/26"
          />
        </div>

        {msg ? (
          <div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">{msg}</div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button type="button" className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold" onClick={onBack} disabled={busy}>
            Back
          </button>
          <button type="submit" className="rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60" disabled={busy}>
            {busy ? "Creating…" : "Create season"}
          </button>
        </div>
      </form>
    </CenterCard>
  );
}

export default function AuthGate() {
  const envOk = Boolean(SUPA_URL && SUPA_KEY);

  const [client] = React.useState(() =>
    createClient(SUPA_URL, SUPA_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  );

  // Normalize "/golf" -> "/golf/"
  React.useEffect(() => {
    try {
      const p = window.location.pathname || "";
      if (p === GH_PAGES_BASE.slice(0, -1)) window.location.replace(GH_PAGES_BASE);
    } catch {}
  }, []);

  const [session, setSession] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const [tenantLoading, setTenantLoading] = React.useState(false);
  const [memberships, setMemberships] = React.useState([]);
  const [societies, setSocieties] = React.useState([]);
  const [activeSocietyId, setActiveSocietyId] = React.useState(() => {
    try { return localStorage.getItem(LS_ACTIVE_SOCIETY) || ""; } catch { return ""; }
  });
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Public society-by-slug mode (no login)
  const [publicLoading, setPublicLoading] = React.useState(false);
  const [publicSociety, setPublicSociety] = React.useState(null);

  // Admin sign in from public view
  const [adminSheetOpen, setAdminSheetOpen] = React.useState(false);

  // Root onboarding
  const [createMode, setCreateMode] = React.useState(false);
  const [inviteCode, setInviteCode] = React.useState("");
  const [newSocietyName, setNewSocietyName] = React.useState("");
  const [newSocietySlug, setNewSocietySlug] = React.useState("");
  const [firstSeasonName, setFirstSeasonName] = React.useState("");

  // Post-login choice + create season
  const [pending, setPending] = React.useState(null);
  const [choiceOpen, setChoiceOpen] = React.useState(false);
  const [createSeasonMode, setCreateSeasonMode] = React.useState(false);
  const [seasonSocietyId, setSeasonSocietyId] = React.useState("");
  const [seasonLabel, setSeasonLabel] = React.useState("");
  const [seasonBusy, setSeasonBusy] = React.useState(false);

  React.useEffect(() => {
    if (!newSocietyName) return;
    if (newSocietySlug) return;
    setNewSocietySlug(slugify(newSocietyName));
  }, [newSocietyName, newSocietySlug]);

  // session tracking
  React.useEffect(() => {
    if (!envOk) return;
    client.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = client.auth.onAuthStateChange((_evt, s) => setSession(s || null));
    return () => { try { sub?.subscription?.unsubscribe?.(); } catch {} };
  }, [client, envOk]);

  // Public mode: if URL contains a slug, fetch that society without requiring login
  React.useEffect(() => {
    if (!envOk) return;
    const slug = getSlugFromPath();
    if (!slug) { setPublicSociety(null); return; }

    let cancelled = false;
    (async () => {
      setPublicLoading(true);
      setMsg("");
      try {
        const { data, error } = await client
          .from("societies")
          .select("id, name, slug, viewer_enabled")
          .eq("slug", slug)
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!data) { if (!cancelled) setPublicSociety(null); return; }
        if (data.viewer_enabled === false) throw new Error("This society is not publicly viewable.");
        if (!cancelled) setPublicSociety(data);
      } catch (e) {
        const raw = e?.message || String(e);
        const code = e?.code || e?.error_code;
        const status = e?.status || e?.statusCode;
        const isRlsDenied = /permission denied/i.test(raw) || code === "42501" || status === 401;
        if (!cancelled && !isRlsDenied) setMsg(raw);
        if (!cancelled) setPublicSociety(null);
      } finally {
        if (!cancelled) setPublicLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [client, envOk]);

  const loadTenant = React.useCallback(async (userId, opts = {}) => {
    if (!envOk || !userId) return;

    const { preferSocietyId = "", preferSocietySlug = "" } = opts || {};
    setTenantLoading(true);
    setMsg("");

    const m = await client.from("memberships").select("society_id, role").eq("user_id", userId);
    if (m.error) { setMsg(m.error.message); setTenantLoading(false); return; }
    const mem = Array.isArray(m.data) ? m.data : [];
    setMemberships(mem);

    const ids = mem.map((x) => x.society_id).filter(Boolean).map(String);
    if (!ids.length) { setSocieties([]); setPickerOpen(false); setTenantLoading(false); return; }

    const s = await client.from("societies").select("id, name, slug, viewer_enabled").in("id", ids);
    if (s.error) { setMsg(s.error.message); setTenantLoading(false); return; }

    const socs = Array.isArray(s.data) ? s.data : [];
    setSocieties(socs);

    let pick = (preferSocietyId && ids.includes(String(preferSocietyId))) ? String(preferSocietyId) : "";

    const wantedSlug = String(preferSocietySlug || "");
    if (!pick && wantedSlug) {
      const bySlug = socs.find((x) => String(x.slug || "") === wantedSlug);
      if (bySlug && ids.includes(String(bySlug.id))) pick = String(bySlug.id);
    }

    if (!pick && activeSocietyId && ids.includes(String(activeSocietyId))) pick = String(activeSocietyId);
    if (!pick && ids.length === 1) pick = ids[0];

    if (!pick && ids.length > 1) { setPickerOpen(true); setTenantLoading(false); return; }
    if (!pick && ids.length) pick = ids[0];

    if (pick) {
      setActiveSocietyId(String(pick));
      try { localStorage.setItem(LS_ACTIVE_SOCIETY, String(pick)); } catch {}
    }

    setPickerOpen(false);
    setTenantLoading(false);
  }, [client, envOk, activeSocietyId]);

  // load memberships + societies (only when logged in)
  React.useEffect(() => {
    if (!envOk) return;
    const userId = session?.user?.id;
    if (!userId) return;

    const preferSocietyId = publicSociety?.id ? String(publicSociety.id) : "";
    loadTenant(userId, preferSocietyId ? { preferSocietyId } : undefined);
  }, [envOk, session?.user?.id, publicSociety?.id, loadTenant]);

  // Load pending onboarding record after login (server-side, not localStorage)
  React.useEffect(() => {
    if (!envOk) return;
    const userId = session?.user?.id;
    if (!userId) return;

    const onboardingHere = isOnboardForced() || !getSlugFromPath();
    if (!onboardingHere) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await client
          .from("pending_onboarding")
          .select("id, email, society_name, society_slug, invite_code, first_season_name, created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        setPending(data || null);

        // If there is a pending request and the user already has memberships, show choice.
        if (data && memberships.length > 0) setChoiceOpen(true);

        // If there is a pending request and no memberships, auto-create society immediately.
        if (data && memberships.length === 0) {
          await finalizeCreateSociety(data);
        }
      } catch (ex) {
        if (!cancelled) setMsg(ex?.message || String(ex));
      }
    })();

    return () => { cancelled = true; };
  }, [envOk, session?.user?.id, memberships.length]);

  async function sendMagicLinkWithRedirect(e, redirectTo) {
    e?.preventDefault?.();
    setMsg("");
    const em = (email || "").trim();
    if (!em) return setMsg("Enter your email.");

    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOtp({
        email: em,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      setMsg("Magic link sent ✓ Check your email");
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink(e) {
    const currentSlug = getSlugFromPath();
    const redirectTo = currentSlug ? `${SITE_URL}${currentSlug}` : SITE_URL;
    return sendMagicLinkWithRedirect(e, redirectTo);
  }

  async function signOut() {
    try { await client.auth.signOut(); } catch {}
  }

  async function requestOnboarding(e) {
    e.preventDefault();
    setMsg("");

    const em = (email || "").trim();
    const name = (newSocietyName || "").trim();
    const code = (inviteCode || "").trim();
    const slug = ((newSocietySlug || "") || slugify(name)).trim();
    const season = (firstSeasonName || "").trim();

    if (!em) return setMsg("Enter your email.");
    if (!name) return setMsg("Enter a society name.");
    if (!code) return setMsg("Enter your invite code.");
    if (!season) return setMsg("Enter a season/competition name.");

    setBusy(true);
    try {
      // Store the request server-side (so it survives the magic link hop on any device)
      const { error } = await client.rpc("request_society_onboarding", {
        p_email: em,
        p_society_name: name,
        p_society_slug: slug,
        p_invite_code: code,
        p_first_season_name: season,
      });
      if (error) throw error;

      // Always bring the user back to onboarding after clicking the magic link
      await sendMagicLinkWithRedirect(e, `${SITE_URL}?onboard=1`);
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function finalizeCreateSociety(p) {
    if (!p) return;
    setMsg("");
    try {
      const { data, error } = await client.rpc("create_society_with_code", {
        society_name: p.society_name,
        society_slug: p.society_slug,
        invite_code: p.invite_code,
        first_season_name: p.first_season_name,
      });
      if (error) throw error;

      // Clear pending record
      try {
        await client.from("pending_onboarding").delete().eq("id", p.id);
      } catch {}

      const newId = String(data || "");
      if (newId) {
        setActiveSocietyId(newId);
        try { localStorage.setItem(LS_ACTIVE_SOCIETY, newId); } catch {}
        if (p.society_slug) window.location.replace(`${SITE_URL}${p.society_slug}`);
      }
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    }
  }

  async function createSeasonForSociety(e) {
    e.preventDefault();
    setMsg("");
    const sid = String(seasonSocietyId || "");
    const label = (seasonLabel || "").trim();
    if (!sid) return setMsg("Choose a society.");
    if (!label) return setMsg("Enter a season/competition name.");

    setSeasonBusy(true);
    try {
      const { error } = await client.from("seasons").insert({ society_id: sid, competition: "season", label });
      if (error) throw error;

      const soc = (societies || []).find((s) => String(s.id) === sid);
      const slug = soc?.slug ? String(soc.slug) : "";
      if (slug) window.location.replace(`${SITE_URL}${slug}`);
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setSeasonBusy(false);
    }
  }

  if (!envOk) {
    return (
      <CenterCard>
        <div className="text-xl font-black text-neutral-900">Config missing</div>
        <div className="mt-2 text-sm text-neutral-700">
          VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are undefined in the deployed build.
        </div>
      </CenterCard>
    );
  }

  // Public viewer mode
  if (!session?.user) {
    if (publicLoading) {
      return <CenterCard><div className="text-sm text-neutral-600">Loading society…</div></CenterCard>;
    }

    if (publicSociety?.id) {
      return (
        <>
          <React.Suspense fallback={<CenterCard><div>Loading…</div></CenterCard>}>
            <AppLazy
              key={String(publicSociety.id)}
              supabase={client}
              session={null}
              activeSocietyId={String(publicSociety.id)}
              activeSocietySlug={publicSociety.slug || ""}
              activeSocietyName={publicSociety.name || ""}
              activeSocietyRole={"viewer"}
            />
          </React.Suspense>

          <FloatingAdminButton onClick={() => { setMsg(""); setAdminSheetOpen(true); }} />
          <AdminSignInSheet
            open={adminSheetOpen}
            onClose={() => setAdminSheetOpen(false)}
            email={email}
            setEmail={setEmail}
            busy={busy}
            msg={msg}
            onSubmit={sendMagicLink}
          />
        </>
      );
    }

    // Root onboarding landing
    if (!createMode) {
      return (
        <CenterCard>
          <div className="text-2xl font-black text-neutral-900">Sign in</div>
          <div className="text-sm text-neutral-600 mt-2">We’ll email you a magic link.</div>

          <form className="mt-4 space-y-3" onSubmit={sendMagicLink}>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Email</label>
              <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
                type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" />
            </div>

            {msg ? (<div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">{msg}</div>) : null}

            <button className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60" disabled={busy}>
              {busy ? "Sending…" : "Send magic link"}
            </button>

            <button type="button" className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
              onClick={() => { setMsg(""); setCreateMode(true); }}>
              Create a new society
            </button>
          </form>
        </CenterCard>
      );
    }

    return (
      <CenterCard>
        <div className="text-2xl font-black text-neutral-900">Create society</div>
        <div className="text-sm text-neutral-600 mt-2">Invite code required. We’ll email you a magic link to finish.</div>

        <form className="mt-4 space-y-3" onSubmit={requestOnboarding}>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Email</label>
            <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Invite code</label>
            <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g. CHART-7F3KQ" />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Society name</label>
            <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={newSocietyName} onChange={(e) => setNewSocietyName(e.target.value)} placeholder="e.g. Den Society" />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Slug (optional)</label>
            <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={newSocietySlug} onChange={(e) => setNewSocietySlug(e.target.value)} placeholder="e.g. den-society" />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">First season / competition</label>
            <input className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={firstSeasonName} onChange={(e) => setFirstSeasonName(e.target.value)} placeholder="e.g. 2026" />
          </div>

          {msg ? (<div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">{msg}</div>) : null}

          <button className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60" disabled={busy}>
            {busy ? "Sending…" : "Send magic link to create"}
          </button>

          <button type="button" className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={() => { setMsg(""); setCreateMode(false); }}>
            Back
          </button>
        </form>
      </CenterCard>
    );
  }

  // Logged-in modes
  if (tenantLoading) {
    return (
      <CenterCard>
        <div className="text-sm text-neutral-600">Loading…</div>
        <button className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold" onClick={signOut}>
          Sign out
        </button>
      </CenterCard>
    );
  }

  const options = (societies || []).slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  const captainSocietyIds = new Set((memberships || []).filter((m) => String(m.role || "") === "captain").map((m) => String(m.society_id)));
  const captainOptions = options.filter((s) => captainSocietyIds.has(String(s.id)));

  if (choiceOpen && pending) {
    return (
      <PostLoginChoiceCard
        email={session.user.email}
        captainSocieties={captainOptions}
        pending={pending}
        onCreateSociety={async () => { setChoiceOpen(false); await finalizeCreateSociety(pending); }}
        onCreateSeason={() => {
          setMsg("");
          if (captainOptions[0]) setSeasonSocietyId(String(captainOptions[0].id));
          setSeasonLabel(pending.first_season_name || "");
          setChoiceOpen(false);
          setCreateSeasonMode(true);
        }}
        onCancel={() => { setMsg(""); setChoiceOpen(false); }}
      />
    );
  }

  if (createSeasonMode) {
    return (
      <CreateSeasonCard
        email={session.user.email}
        societies={captainOptions}
        societyId={seasonSocietyId}
        setSocietyId={setSeasonSocietyId}
        label={seasonLabel}
        setLabel={setSeasonLabel}
        msg={msg}
        busy={seasonBusy}
        onCreate={createSeasonForSociety}
        onBack={() => { setMsg(""); setCreateSeasonMode(false); setChoiceOpen(true); }}
      />
    );
  }

  if (pickerOpen) {
    return (
      <CenterCard>
        <div className="text-xs font-black tracking-widest uppercase text-neutral-400">Choose society</div>
        <div className="text-lg font-black text-neutral-900 mt-1">{session.user.email}</div>
        <div className="mt-4 space-y-2">
          {options.map((s) => (
            <button
              key={s.id}
              className="w-full text-left rounded-2xl border border-neutral-200 bg-white px-4 py-3 hover:bg-neutral-50"
              onClick={() => {
                const id = String(s.id);
                setActiveSocietyId(id);
                try { localStorage.setItem(LS_ACTIVE_SOCIETY, id); } catch {}
                setPickerOpen(false);
              }}
            >
              <div className="font-black text-neutral-900">{s.name || s.slug || s.id}</div>
              <div className="text-xs text-neutral-500">{s.slug ? `/${s.slug}` : s.id}</div>
            </button>
          ))}
        </div>

        <button className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold" onClick={signOut}>
          Sign out
        </button>
      </CenterCard>
    );
  }

  const activeSoc = options.find((s) => String(s.id) === String(activeSocietyId));
  const role = memberships.find((m) => String(m.society_id) === String(activeSocietyId))?.role || "player";

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
