import React from "react";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const LS_ACTIVE_SOCIETY = "den_active_society_id_v1";

function Center({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        {children}
      </div>
    </div>
  );
}

export default function AuthGate() {
  const [client] = React.useState(() => createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true } }));
  const [session, setSession] = React.useState(null);
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const [memberships, setMemberships] = React.useState([]);
  const [societies, setSocieties] = React.useState([]);
  const [activeSocietyId, setActiveSocietyId] = React.useState(() => {
    try { return localStorage.getItem(LS_ACTIVE_SOCIETY) || ""; } catch { return ""; }
  });

  React.useEffect(() => {
    client.auth.getSession().then(({ data }) => setSession(data?.session || null));
    const { data: sub } = client.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => { try { sub?.subscription?.unsubscribe?.(); } catch {} };
  }, [client]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session?.user?.id) return;
      setMsg("");

      const m = await client.from("memberships").select("society_id, role").eq("user_id", session.user.id);
      if (cancelled) return;
      if (m.error) { setMsg(m.error.message); return; }

      const mem = Array.isArray(m.data) ? m.data : [];
      setMemberships(mem);

      const ids = mem.map(x => x.society_id).filter(Boolean);
      if (!ids.length) { setSocieties([]); return; }

      const s = await client.from("societies").select("id, name, slug").in("id", ids);
      if (cancelled) return;
      if (s.error) { setMsg(s.error.message); return; }

      const socs = Array.isArray(s.data) ? s.data : [];
      setSocieties(socs);

      let pick = activeSocietyId && ids.includes(activeSocietyId) ? activeSocietyId : "";
      if (!pick && ids.length === 1) pick = ids[0];
      if (!pick && ids.length) pick = ids[0];
      if (pick) setActiveSocietyId(String(pick));
    }
    load();
    return () => { cancelled = true; };
  }, [client, session?.user?.id]);

  React.useEffect(() => {
    try { if (activeSocietyId) localStorage.setItem(LS_ACTIVE_SOCIETY, activeSocietyId); } catch {}
  }, [activeSocietyId]);

  async function sendMagicLink(e) {
    e.preventDefault();
    setMsg("");
    const em = (email || "").trim();
    if (!em) { setMsg("Enter your email."); return; }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}${window.location.hash || ""}`;
      const { error } = await client.auth.signInWithOtp({ email: em, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setMsg("Magic link sent ✓ Check your email");
    } catch (ex) {
      setMsg(ex?.message || String(ex));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() { await client.auth.signOut(); }

  if (!session?.user) {
    return (
      <Center>
        <div className="text-xs font-black tracking-widest uppercase text-neutral-400">Den Society</div>
        <div className="text-2xl font-black text-neutral-900 mt-1">Sign in</div>
        <div className="text-sm text-neutral-600 mt-2">We’ll email you a magic link.</div>

        <form className="mt-4 space-y-3" onSubmit={sendMagicLink}>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Email</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-300"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          {msg ? (
            <div className={"text-sm rounded-xl px-3 py-2 " + (String(msg).includes("sent") ? "bg-emerald-50 border border-emerald-200 text-emerald-900" : "bg-rose-50 border border-rose-200 text-rose-900")}>
              {msg}
            </div>
          ) : null}

          <button className="w-full rounded-xl bg-black text-white px-4 py-2.5 font-bold disabled:opacity-60" disabled={busy}>
            {busy ? "Sending…" : "Send magic link"}
          </button>
        </form>
      </Center>
    );
  }

  if (session?.user && memberships && memberships.length === 0) {
    return (
      <Center>
        <div className="text-xs font-black tracking-widest uppercase text-neutral-400">Signed in as</div>
        <div className="text-lg font-black text-neutral-900 mt-1">{session.user.email}</div>
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          You don’t have access to any societies yet. Ask an admin to add you to the memberships table.
        </div>
        <button className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold" onClick={signOut}>
          Sign out
        </button>
        {msg && <div className="mt-3 text-sm text-rose-700">{msg}</div>}
      </Center>
    );
  }

  const options = societies.slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));
  const activeSoc = options.find(s => String(s.id) === String(activeSocietyId));

  if (activeSocietyId) {
    window.__activeSocietyId = activeSocietyId;
    const role = (memberships.find(m => String(m.society_id) === String(activeSocietyId))?.role) || "member";
    window.__activeSocietyRole = role;
    window.__activeSocietyName = activeSoc?.name || "";
  }

  const AppLazy = React.useMemo(() => React.lazy(() => import("./App.jsx")), [activeSocietyId]);

  return (
    <React.Suspense fallback={<Center><div className="text-sm text-neutral-600">Loading…</div></Center>}>
      {memberships.length > 1 ? (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 shadow-xl p-4">
            <div className="text-xs font-black tracking-widest uppercase text-neutral-400">Choose society</div>
            <div className="text-lg font-black text-neutral-900 mt-1">{session.user.email}</div>

            <div className="mt-3 space-y-2">
              {options.map(s => (
                <button
                  key={s.id}
                  className={"w-full text-left rounded-2xl border px-4 py-3 " + (String(s.id) === String(activeSocietyId) ? "border-black bg-neutral-50" : "border-neutral-200 bg-white")}
                  onClick={() => setActiveSocietyId(String(s.id))}
                >
                  <div className="font-black text-neutral-900">{s.name || s.slug || s.id}</div>
                  <div className="text-xs text-neutral-500">{s.slug ? `/${s.slug}` : s.id}</div>
                </button>
              ))}
            </div>

            <button className="mt-4 w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 font-bold" onClick={signOut}>
              Sign out
            </button>
            {msg && <div className="mt-3 text-sm text-rose-700">{msg}</div>}
          </div>
        </div>
      ) : null}

      <AppLazy />
    </React.Suspense>
  );
}
