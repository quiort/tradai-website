import { useCallback, useEffect, useMemo, useState } from 'react';
import { SUPABASE_KEY, SUPABASE_URL } from './track.js';

// Owner-only dashboard at gettradai.app/admin. Sign-in uses a Supabase Auth user;
// the database only returns rows to the owner email (row-level security).
const SESSION_KEY = 'tradai-admin-session';
const KIND_LABEL = {
  visit: 'Website visit', download: 'Download', install: 'App installed', open: 'App opened',
  signup: 'Account created', signin: 'Signed in', pro_open: 'Opened Get Pro', pro_proof: 'Sent payment', pro_active: 'Pro activated',
};

const flag = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');
const fmt = (d) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const DAY = 86400000;

function loadSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function saveSession(s) { try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

async function auth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Sign-in failed');
  return { token: data.access_token, refresh: data.refresh_token, expires: Date.now() + (data.expires_in || 3600) * 1000, email: data.user?.email };
}

export default function AdminPanel() {
  const [session, setSession] = useState(loadSession);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState('overview');
  const [kind, setKind] = useState('all');
  const [days, setDays] = useState(30);

  const signOut = useCallback(() => { saveSession(null); setSession(null); setEvents([]); }, []);

  const load = useCallback(async () => {
    let s = session;
    if (!s) return;
    try {
      if (Date.now() > s.expires - 60000) { s = await auth('token?grant_type=refresh_token', { refresh_token: s.refresh }); saveSession(s); setSession(s); }
      setStatus('Loading…');
      const since = new Date(Date.now() - days * DAY).toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/events?select=*&created_at=gte.${since}&order=created_at.desc&limit=5000`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${s.token}` },
      });
      if (res.status === 401) { signOut(); return; }
      if (!res.ok) throw new Error(`Database error ${res.status}`);
      const rows = await res.json();
      setEvents(rows);
      setStatus(rows.length ? '' : 'No data yet for this period. This account only sees data if it is the owner email.');
    } catch (e) { setStatus(e.message); }
  }, [session, days, signOut]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const within = (e, d) => now - new Date(e.created_at).getTime() < d * DAY;
    const count = (k, d) => events.filter((e) => e.kind === k && within(e, d)).length;
    const countries = {};
    for (const e of events) if (e.country && (e.kind === 'visit' || e.kind === 'download')) countries[e.country] = (countries[e.country] || 0) + 1;
    const users = {};
    for (const e of [...events].reverse()) {
      if (e.source !== 'app' || !e.email) continue;
      const u = users[e.email] || (users[e.email] = { email: e.email, first: e.created_at, opens: 0, pro: false });
      u.last = e.created_at; u.version = e.app_version || u.version; u.country = e.country || u.country; u.ip = e.ip || u.ip;
      if (e.kind === 'open') u.opens += 1;
      if (e.kind === 'pro_active') u.pro = true;
    }
    return {
      visits7: count('visit', 7), downloads7: count('download', 7), installs7: count('install', 7),
      visitsToday: count('visit', 1), downloadsToday: count('download', 1),
      proofs: count('pro_proof', days),
      countries: Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 12),
      users: Object.values(users).sort((a, b) => new Date(b.last) - new Date(a.last)),
    };
  }, [events, days]);

  if (!session) return <AdminLogin onSignedIn={(s) => { saveSession(s); setSession(s); }} />;

  const shown = events.filter((e) => kind === 'all' || e.kind === kind);
  const maxCountry = stats.countries[0]?.[1] || 1;

  return (
    <div className="adm">
      <header className="adm-top">
        <a href="/" className="logo">Trad<b>AI</b> <span>admin</span></a>
        <div className="adm-top-r">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="adm-kpis">
        <div><span>Visits · 7 days</span><b>{stats.visits7}</b><small>{stats.visitsToday} today</small></div>
        <div><span>Downloads · 7 days</span><b>{stats.downloads7}</b><small>{stats.downloadsToday} today</small></div>
        <div><span>New installs · 7 days</span><b>{stats.installs7}</b><small>from the app</small></div>
        <div><span>App users</span><b>{stats.users.length}</b><small>with an email, in period</small></div>
        <div><span>Payments sent</span><b>{stats.proofs}</b><small>in period</small></div>
      </section>

      <nav className="adm-tabs">
        {['overview', 'users', 'events'].map((t) => <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </nav>
      {status && <p className="adm-status">{status}</p>}

      {tab === 'overview' && (
        <section className="adm-grid">
          <div className="adm-box">
            <h3>Top countries</h3>
            {stats.countries.length ? stats.countries.map(([cc, n]) => (
              <div className="adm-bar" key={cc}><span>{flag(cc)} {cc}</span><i style={{ width: `${(n / maxCountry) * 100}%` }} /><b>{n}</b></div>
            )) : <p className="adm-muted">No visits yet.</p>}
          </div>
          <div className="adm-box">
            <h3>Funnel · period</h3>
            {['visit', 'download', 'install', 'signup', 'pro_open', 'pro_proof', 'pro_active'].map((k) => (
              <div className="adm-row" key={k}><span>{KIND_LABEL[k]}</span><b>{events.filter((e) => e.kind === k).length}</b></div>
            ))}
          </div>
        </section>
      )}

      {tab === 'users' && (
        <div className="adm-table"><table>
          <thead><tr><th>Email</th><th>Country</th><th>IP</th><th>Version</th><th>Opens</th><th>First seen</th><th>Last seen</th><th>Plan</th></tr></thead>
          <tbody>{stats.users.map((u) => (
            <tr key={u.email}><td>{u.email}</td><td>{flag(u.country)} {u.country || '—'}</td><td className="mono">{u.ip || '—'}</td><td>{u.version || '—'}</td><td>{u.opens}</td><td>{fmt(u.first)}</td><td>{fmt(u.last)}</td><td>{u.pro ? 'Pro' : 'Free'}</td></tr>
          ))}</tbody>
        </table>{!stats.users.length && <p className="adm-muted">No app users yet. They appear once people use the updated app.</p>}</div>
      )}

      {tab === 'events' && (
        <>
          <div className="adm-filter">
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Event type">
              <option value="all">All events</option>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <span className="adm-muted">{shown.length} events</span>
          </div>
          <div className="adm-table"><table>
            <thead><tr><th>Time</th><th>Event</th><th>From</th><th>Email</th><th>Country</th><th>IP</th><th>Device</th></tr></thead>
            <tbody>{shown.slice(0, 500).map((e) => (
              <tr key={e.id}><td>{fmt(e.created_at)}</td><td>{KIND_LABEL[e.kind] || e.kind}</td><td>{e.source === 'app' ? `App ${e.app_version || ''}` : 'Website'}</td><td>{e.email || '—'}</td><td>{flag(e.country)} {e.country || '—'}</td><td className="mono">{e.ip || '—'}</td><td className="adm-ua" title={e.user_agent || ''}>{e.platform || (e.user_agent || '').slice(0, 30) || '—'}</td></tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </div>
  );
}

function AdminLogin({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { onSignedIn(await auth('token?grant_type=password', { email: email.trim(), password })); }
    catch (err) { setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="adm adm-login">
      <form onSubmit={submit}>
        <a href="/" className="logo">Trad<b>AI</b> <span>admin</span></a>
        <label htmlFor="adm-email">Email<input id="adm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label htmlFor="adm-pass">Password<input id="adm-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="adm-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
