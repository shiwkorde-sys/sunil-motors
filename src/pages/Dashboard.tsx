import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { downloadCsv, parseCsv, type ParsedImport } from '../lib/csv';
import { emptyQuery, searchParts, stockState, type Query } from '../lib/search';
import { supabase } from '../lib/supabase';
import type { Checkout, Part, Profile } from '../lib/types';
import { useParts } from '../lib/useParts';
import PartDetail from '../components/PartDetail';
import PartForm from '../components/PartForm';
import SearchPanel from '../components/SearchPanel';
import { ConfigWarning, ErrorNote, Modal, StockBadge } from '../components/ui';

const TABS = ['Overview', 'Inventory', 'Import', 'Checkout log', 'Team'] as const;
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
        {tab === 'Import' && <ImportCsv reload={reload} />}
        {tab === 'Checkout log' && <Log />}
        {tab === 'Team' && <Team />}
      </main>
    </div>
  );
}

function Overview({ parts }: { parts: Part[] }) {
  const out = parts.filter((p) => stockState(p) === 'out');
  const low = parts.filter((p) => stockState(p) === 'low');
  const units = parts.reduce((s, p) => s + p.quantity_available, 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    parts.forEach((p) => m.set(p.category ?? 'Uncategorised', (m.get(p.category ?? 'Uncategorised') ?? 0) + p.quantity_available));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [parts]);
  const max = Math.max(1, ...byCat.map(([, n]) => n));

  const Kpi = ({ label, value, tone = '' }: { label: string; value: number; tone?: string }) => (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`font-display text-5xl font-bold ${tone}`}>{value}</div>
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Unique parts (SKUs)" value={parts.length} />
        <Kpi label="Units in stock" value={units} />
        <Kpi label="Low stock" value={low.length} tone="text-amber-600" />
        <Kpi label="Out of stock" value={out.length} tone="text-red-600" />
      </div>
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

function Inventory({ parts, reload }: { parts: Part[]; reload: () => void }) {
  const [query, setQuery] = useState<Query>(emptyQuery);
  const [editing, setEditing] = useState<Part | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const rows = useMemo(() => searchParts(parts, query), [parts, query]);
  const viewPart = parts.find((p) => p.id === viewing);

  async function remove(p: Part) {
    if (!confirm(`Delete "${p.name}"? Parts with checkout history cannot be deleted — set quantity to 0 instead.`)) return;
    const { error } = await supabase.from('parts').delete().eq('id', p.id);
    if (error) setErr(error.code === '23503' ? 'This part has checkout history, so it cannot be deleted. Set its quantity to 0 instead.' : error.message);
    else reload();
  }

  return (
    <>
      <SearchPanel query={query} onChange={setQuery} parts={parts} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{rows.length} parts</span>
        <div className="flex gap-2">
          <button onClick={() => downloadCsv('inventory.csv', parts.map(({ id, compatible_models, ...r }) => ({ ...r, compatible_models: compatible_models.join('; ') })))} className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm">
            Export CSV
          </button>
          <button onClick={() => setEditing('new')} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">+ Add part</button>
        </div>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{['SKU', 'Part', 'Compatible models', 'Shelf', 'Stock', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-4 py-2"><button onClick={() => setViewing(p.id)} className="text-left font-semibold hover:underline">{p.name}</button><div className="text-xs text-slate-400">{p.company} · {p.category}</div></td>
                <td className="max-w-xs px-4 py-2">{p.compatible_models.join(', ')}</td>
                <td className="px-4 py-2">{p.shelf_location}</td>
                <td className="px-4 py-2"><StockBadge part={p} /></td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button onClick={() => setEditing(p)} className="mr-3 text-brand hover:underline">Edit</button>
                  <button onClick={() => remove(p)} className="text-slate-400 hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <PartForm part={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {viewPart && (
        <Modal title="Part details" onClose={() => setViewing(null)}>
          <PartDetail part={viewPart} onCheckedOut={() => { reload(); setViewing(null); }} onOpenPart={setViewing} />
        </Modal>
      )}
    </>
  );
}

function ImportCsv({ reload }: { reload: () => void }) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    setParsed(null); setStatus(null); setError(null);
    if (!file) return;
    try { setParsed(await parseCsv(file)); } catch (e) { setError((e as Error).message); }
  }

  async function run() {
    if (!parsed) return;
    setBusy(true); setError(null);
    for (let i = 0; i < parsed.rows.length; i += 200) {
      const { error } = await supabase.from('parts').upsert(parsed.rows.slice(i, i + 200), { onConflict: 'sku' });
      if (error) { setBusy(false); return setError(`Stopped after ${i} rows: ${error.message}`); }
      setStatus(`Imported ${Math.min(i + 200, parsed.rows.length)} of ${parsed.rows.length}…`);
    }
    setBusy(false); setStatus(`Done — ${parsed.rows.length} parts added or updated.`); setParsed(null); reload();
  }

  return (
    <section className="max-w-3xl space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <p className="text-slate-600">
        Upload a CSV (in Excel: open the <b>07_All_Parts_Master_CSV</b> sheet → File → Save As → CSV). Parts with a SKU that already exists are
        <b> updated</b>; new SKUs are <b>added</b>. Each part's vehicle model becomes its first compatible model.
      </p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <ErrorNote>{error}</ErrorNote>}
      {parsed && (
        <div className="space-y-3">
          <p><b>{parsed.rows.length}</b> parts ready to import{parsed.skipped.length > 0 && <>, {parsed.skipped.length} rows skipped</>}.</p>
          {parsed.skipped.length > 0 && <ul className="max-h-24 overflow-auto text-xs text-amber-700">{parsed.skipped.map((s) => <li key={s}>{s}</li>)}</ul>}
          <table className="w-full text-xs">
            <tbody>{parsed.rows.slice(0, 5).map((r) => <tr key={r.sku} className="border-t"><td className="py-1 font-mono">{r.sku}</td><td>{r.name}</td><td>{r.compatible_models.join(', ')}</td><td>{r.quantity_available}</td></tr>)}</tbody>
          </table>
          <button disabled={busy} onClick={run} className="rounded-xl bg-brand px-6 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Importing…' : 'Import now'}</button>
        </div>
      )}
      {status && <p className="rounded-xl bg-green-50 p-3 text-green-800">{status}</p>}
    </section>
  );
}

function Log() {
  const [rows, setRows] = useState<Checkout[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('checkout_transactions').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data as Checkout[])));
  }, []);
  return (
    <>
      <div className="flex justify-between">
        <p className="text-sm text-slate-500">Read-only history. Entries cannot be edited or deleted.</p>
        <button onClick={() => downloadCsv('checkouts.csv', rows.map((r) => ({ ...r })))} className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm">Export CSV</button>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['When', 'Part', 'Qty', 'Mechanic', 'Vehicle', 'Job ref'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2">{r.part_name} <span className="text-xs text-slate-400">{r.sku}</span></td>
                <td className="px-4 py-2">{r.quantity}</td>
                <td className="px-4 py-2">{r.mechanic_name}</td>
                <td className="px-4 py-2 font-mono">{r.vehicle_registration ?? '-'}</td>
                <td className="px-4 py-2">{r.job_reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <p className="text-sm text-slate-500">Mechanics create their own account on the login page. Each person's name is used in the checkout log. Promote someone to admin here, or send a password reset link if they forgot theirs.</p>
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
