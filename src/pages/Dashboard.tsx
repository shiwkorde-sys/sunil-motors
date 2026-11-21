import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { stockState } from '../lib/search';
import { supabase } from '../lib/supabase';
import type { Part, Profile } from '../lib/types';
import { useParts } from '../lib/useParts';
import Inventory from '../components/Inventory';
import StockKpis from '../components/StockKpis';
import Billing from '../components/Billing';
import Sales from '../components/Sales';
import SettingsPanel from '../components/SettingsPanel';
import { ConfigWarning, ErrorNote, StockBadge } from '../components/ui';

const TABS = ['Overview', 'Inventory', 'Billing', 'Sales', 'Team', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { parts, loading, error, reload } = useParts();
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 bg-slate-900 p-4 text-white lg:w-56">
        <div className="mb-3 font-display text-2xl font-bold uppercase tracking-wide lg:mb-6">Sunil Motors</div>
        <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left lg:w-full ${tab === t ? 'bg-brand font-semibold' : 'hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </nav>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 lg:mt-8 lg:block lg:space-y-2">
          <Link to="/m" className="block underline">Mechanic view</Link>
          <div className="truncate">{profile?.email}</div>
          <button onClick={signOut} className="underline">Sign out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 space-y-4 p-4 lg:p-6">
        <ConfigWarning />
        <h1 className="font-display text-3xl font-bold uppercase">{tab}</h1>
        {error && <ErrorNote>Could not load parts: {error}</ErrorNote>}
        {loading && <p className="text-slate-500">Loading…</p>}
        {tab === 'Overview' && <Overview parts={parts} />}
        {tab === 'Inventory' && <Inventory parts={parts} reload={reload} />}
        {tab === 'Billing' && <Billing parts={parts} reload={reload} />}
        {tab === 'Settings' && <SettingsPanel />}
        {tab === 'Sales' && <Sales parts={parts} />}
        {tab === 'Team' && <Team />}
      </main>
    </div>
  );
}

function Overview({ parts }: { parts: Part[] }) {
  const out = parts.filter((p) => stockState(p) === 'out');
  const low = parts.filter((p) => stockState(p) === 'low');
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    parts.forEach((p) => m.set(p.category ?? 'Uncategorised', (m.get(p.category ?? 'Uncategorised') ?? 0) + p.quantity_available));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [parts]);
  const max = Math.max(1, ...byCat.map(([, n]) => n));

  return (
    <>
      <StockKpis parts={parts} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Needs restocking</h2>
          {[...out, ...low].length === 0 && <p className="text-slate-500">Everything is healthy 👍</p>}
          <ul className="divide-y">
            {[...out, ...low].slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>{p.name} <span className="text-slate-400">· {p.sku}</span></span>
                <StockBadge part={p} />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold">Units by category</h2>
          <ul className="space-y-2">
            {byCat.map(([c, n]) => (
              <li key={c} className="text-sm">
                <div className="flex justify-between"><span>{c}</span><b>{n}</b></div>
                <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-brand" style={{ width: `${(n / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Team() {
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setPeople((data as Profile[]) ?? []));
  useEffect(() => { void load(); }, []);

  async function setRole(p: Profile, role: Profile['role']) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id);
    if (error) setErr(error.message); else void load();
  }

  async function sendReset(p: Profile) {
    setErr(null); setNote(null);
    if (!p.email) return setErr('This person has no email on file.');
    const { error } = await supabase.auth.resetPasswordForEmail(p.email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) setErr(/rate limit/i.test(error.message) ? 'Too many emails were sent. Wait an hour and try again.' : error.message);
    else setNote(`Reset link sent to ${p.email}. Ask them to check Inbox and Spam.`);
  }

  return (
    <section className="max-w-2xl space-y-3">
      <p className="text-sm text-slate-500">Mechanics create their own account on the login page. Each person's name is used in the Sales list. Promote someone to admin here, or send a password reset link if they forgot theirs.</p>
      {err && <ErrorNote>{err}</ErrorNote>}
      {note && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{note}</p>}
      <ul className="divide-y rounded-2xl bg-white shadow-sm">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><div className="font-semibold">{p.full_name}</div><div className="truncate text-sm text-slate-500">{p.email}</div></div>
            <div className="flex items-center gap-2">
              <button onClick={() => sendReset(p)} className="h-11 rounded-lg border px-3 text-sm font-semibold hover:bg-slate-50">Send reset link</button>
              <select value={p.role} disabled={p.id === me?.id} onChange={(e) => setRole(p, e.target.value as Profile['role'])} className="h-11 rounded-lg border px-3" aria-label={`Role for ${p.full_name}`}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
