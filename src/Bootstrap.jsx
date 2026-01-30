import React from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const GH_PAGES_BASE = "/golf/";
const SITE_ORIGIN = "https://kevanojb.github.io";
const SITE_URL = `${SITE_ORIGIN}${GH_PAGES_BASE}`;
const LS_ACTIVE_SOCIETY = "den_active_society_id_v1";

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

function normalizeGolfRoot() {
  try {
    const p = window.location.pathname || "";
    if (p === GH_PAGES_BASE.slice(0, -1)) window.location.replace(GH_PAGES_BASE); // "/golf" -> "/golf/"
  } catch {}
}

function getSlugFromPath() {
  try {
    let path = window.location.pathname || "/";
    if (path === GH_PAGES_BASE.slice(0, -1)) path = GH_PAGES_BASE;
    if (!path.startsWith(GH_PAGES_BASE)) return "";
    const rest = path.slice(GH_PAGES_BASE.length);
    return (rest.split("/").filter(Boolean)[0] || "").trim();
  } catch {
    return "";
  }
}

function setGlobals({ client, societyId, societySlug, societyName, role }) {
  window.__supabase_client__ = client;
  window.__activeSocietyId = String(societyId || "");
  window.__activeSocietySlug = String(societySlug || "");
  window.__activeSocietyName = String(societyName || "");
  window.__activeSocietyRole = String(role || "");
}

export default function Bootstrap() {
  const envOk = Boolean(SUPA_URL && SUPA_KEY);

  const [client] = React.useState(() =>
    createClient(SUPA_URL, SUPA_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  );

  React.useEffect(() => {
    normalizeGolfRoot();
  }, []);

  const [session, setSession] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  // Public society mode
  const [publicLoading, setPublicLoading] = React.useState(false);
  const [publicSociety, setPublicSociety] = React.useState(null);

  // Captain portal data
  const [loadingPortal, setLoadingPortal] = React.useState(false);
  const [memberships, setMemberships] = React.useState([]);
  const [societies, setSocieties] = React.useState([]);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [activeSocietyId, setActiveSocietyId] = React.useState(() => {
    try {
      return localStorage.getItem(LS_ACTIVE_SOCIETY) || "";
    } catch {
      return "";
    }
  });

  // Create society UI
  const [createOpen, setCreateOpen] = React.useState(false);
  const [societyName, setSocietyName] = React.useState("");
  const [societySlug, setSocietySlug] = React.useState("");
  const [seasonLabel, setSeasonLabel] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (!societyName) return;
    if (societySlug) return;
    setSocietySlug(slugify(societyName));
  }, [societyName, societySlug]);

  // Track session
  React.useEffect(() => {
    if (!envOk) return;

    client.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = client.auth.onAuthStateChange((_evt, s) => setSession(s || null));
    return () => {
      try {
        sub?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [client, envOk]);

  // Public view: if URL includes slug, load as viewer (no login required)
  React.useEffect(() => {
    if (!envOk) return;

    const slug = getSlugFromPath();
    if (!slug) {
      setPublicSociety(null);
      return;
    }

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
        if (!data) {
          if (!cancelled) setPublicSociety(null);
          return;
        }

        if (data.viewer_enabled === false) {
          throw new Error("This society is not publicly viewable.");
        }

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

    return () => {
      cancelled = true;
    };
  }, [client, envOk]);

  // Captain portal load (only when logged in, and only on /golf root)
  React.useEffect(() => {
    if (!envOk) return;
    const slug = getSlugFromPath();
    if (slug) return; // slug routes are public viewer routes (or captain inside App)

    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;
    (async () => {
      setLoadingPortal(true);
      setMsg("");
      try {
        const m = await client.from("memberships").select("society_id, role").eq("user_id", userId);
        if (m.error) throw m.error;
        const mem = Array.isArray(m.data) ? m.data : [];
        if (cancelled) return;
        setMemberships(mem);

        const ids = mem.map((x) => x.society_id).filter(Boolean).map(String);

        if (!ids.length) {
          setSocieties([]);
          setPickerOpen(false);
          setCreateOpen(true); // no societies -> straight to create
          return;
        }

        const s = await client.from("societies").select("id, name, slug, viewer_enabled").in("id", ids);
        if (s.error) throw s.error;
        const socs = Array.isArray(s.data) ? s.data : [];
        if (cancelled) return;
        setSocieties(socs);

        // pick remembered society or open picker
        let pick = "";
        if (activeSocietyId && ids.includes(String(activeSocietyId))) pick = String(activeSocietyId);
        if (!pick && ids.length === 1) pick = ids[0];

        if (!pick && ids.length > 1) {
          setPickerOpen(true);
          return;
        }

        if (!pick) pick = ids[0];

        setActiveSocietyId(String(pick));
        try {
          localStorage.setItem(LS_ACTIVE_SOCIETY, String(pick));
        } catch {}

        // jump straight into society app when possible
        const soc = socs.find((x) => String(x.id) === String(pick));
        if (soc?.slug) window.location.replace(`${SITE_URL}${soc.slug}`);
      } catch (ex) {
        if (!cancelled) setMsg(ex?.message || String(ex));
      } finally {
        if (!cancelled) setLoadingPortal(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, envOk, session?.user?.id, activeSocietyId]);

  async function sendMagicLink(e) {
    e.preventDefault();
    setMsg("");

    const em = (email || "").trim();
    if (!em) return setMsg("Enter your email.");

    setBusy(true);
    try {
      const { error } = await client.auth.signInWithOtp({
        email: em,
        options: {
          emailRedirectTo: SITE_URL, // always back to /golf/
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setMsg("Magic link sent ✓ Check your email");
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      await client.auth.signOut();
    } catch {}
  }

  async function createSociety(e) {
    e.preventDefault();
    setMsg("");

    const userId = session?.user?.id;
    if (!userId) return setMsg("Please sign in first.");

    const name = (societyName || "").trim();
    const slug = (societySlug || "").trim() || slugify(name);
    const season = (seasonLabel || "").trim() || "Season 1";

    if (!name) return setMsg("Enter a society name.");
    if (!slug) return setMsg("Enter a slug.");

    setCreating(true);
    try {
      // 1) Create society
      const insSoc = await client
        .from("societies")
        .insert({ name, slug, viewer_enabled: true })
        .select("id, name, slug")
        .single();

      if (insSoc.error) throw insSoc.error;

      const newSoc = insSoc.data;
      const sid = String(newSoc.id);

      // 2) Make creator captain
      const insMem = await client
        .from("memberships")
        .insert({ society_id: sid, user_id: userId, role: "captain" });

      if (insMem.error) throw insMem.error;

      // 3) Create first season (supports schemas that require season_id/start_date/end_date)
      const today = new Date();
      const start = today.toISOString().slice(0, 10);
      const endDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
      const end = endDate.toISOString().slice(0, 10);

      const season_id = slugify(season) || "season-1";
      const insSeason = await client.from("seasons").insert({
        society_id: sid,
        season_id,
        label: season,
        competition: "season",
        start_date: start,
        end_date: end,
      });

      if (insSeason.error) throw insSeason.error;

      // Remember and redirect
      try {
        localStorage.setItem(LS_ACTIVE_SOCIETY, sid);
      } catch {}

      window.location.replace(`${SITE_URL}${newSoc.slug}`);
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setCreating(false);
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

  // Slug route: render public viewer (or captain can still sign in via the app itself if you expose it there)
  if (getSlugFromPath()) {
    if (publicLoading) {
      return (
        <CenterCard>
          <div className="text-sm text-neutral-600">Loading society…</div>
        </CenterCard>
      );
    }

    if (!publicSociety?.id) {
      return (
        <CenterCard>
          <div className="text-2xl font-black text-neutral-900">Society not found</div>
          <div className="text-sm text-neutral-600 mt-2">
            Ask your captain for the correct link.
          </div>
          {msg ? (
            <div className="mt-3 text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">
              {msg}
            </div>
          ) : null}
        </CenterCard>
      );
    }

    // Set globals for App.jsx
    setGlobals({
      client,
      societyId: publicSociety.id,
      societySlug: publicSociety.slug || "",
      societyName: publicSociety.name || "",
      role: "viewer",
    });

    return (
      <React.Suspense fallback={<CenterCard><div>Loading…</div></CenterCard>}>
        <AppLazy />
      </React.Suspense>
    );
  }

  // Root route (/golf): captain portal
  if (!session?.user) {
    return (
      <CenterCard>
        <div className="text-2xl font-black text-neutral-900">Captain portal</div>
        <div className="text-sm text-neutral-600 mt-2">Sign in to create or manage a society.</div>

        <form className="mt-4 space-y-3" onSubmit={sendMagicLink}>
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
        </form>
      </CenterCard>
    );
  }

  if (loadingPortal) {
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

  const options = (societies || [])
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

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
                const sid = String(s.id);
                try {
                  localStorage.setItem(LS_ACTIVE_SOCIETY, sid);
                } catch {}
                window.location.replace(`${SITE_URL}${s.slug || ""}`);
              }}
            >
              <div className="font-black text-neutral-900">{s.name || s.slug || s.id}</div>
              <div className="text-xs text-neutral-500">{s.slug ? `/${s.slug}` : s.id}</div>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={() => {
              setMsg("");
              setPickerOpen(false);
              setCreateOpen(true);
            }}
          >
            Create society
          </button>
          <button
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </CenterCard>
    );
  }

  if (createOpen) {
    return (
      <CenterCard>
        <div className="text-2xl font-black text-neutral-900">Create society</div>
        <div className="text-sm text-neutral-600 mt-2">
          This creates a public viewer link for golfers and makes you the captain.
        </div>

        <form className="mt-4 space-y-3" onSubmit={createSociety}>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Society name</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={societyName}
              onChange={(e) => setSocietyName(e.target.value)}
              placeholder="e.g. Dennis The Menace"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Slug</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={societySlug}
              onChange={(e) => setSocietySlug(e.target.value)}
              placeholder="e.g. dennis-the-menace"
            />
            <div className="text-xs text-neutral-500 mt-1">
              Golfers will use: <span className="font-mono">{SITE_URL}</span><span className="font-mono">{societySlug || "your-slug"}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">First season</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white"
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              placeholder="e.g. 2026"
            />
          </div>

          {msg ? (
            <div className="text-sm rounded-xl px-3 py-2 border border-neutral-200 bg-neutral-50">
              {msg}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
              onClick={() => {
                setMsg("");
                if (options.length > 0) {
                  setCreateOpen(false);
                  setPickerOpen(true);
                } else {
                  signOut();
                }
              }}
              disabled={creating}
            >
              Back
            </button>
            <button
              type="submit"
              className="rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60"
              disabled={creating}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </CenterCard>
    );
  }

  // If we reach here with societies already loaded, we normally redirect into a society.
  // Fallback: show a simple portal page.
  return (
    <CenterCard>
      <div className="text-2xl font-black text-neutral-900">Captain portal</div>
      <div className="text-sm text-neutral-600 mt-2">{session.user.email}</div>

      <div className="mt-4 space-y-2">
        <button
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={() => {
            setMsg("");
            setCreateOpen(true);
          }}
        >
          Create society
        </button>

        <button
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </CenterCard>
  );
}
