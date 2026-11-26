import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'framer-motion';
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
import AdminNav from '../components/AdminNav';
import CategoryBars from '../components/CategoryBars';
import RestockList from '../components/RestockList';
import { emptyQuery, type Query } from '../lib/search';
import { ConfigWarning, ErrorNote, Modal } from '../components/ui';

const TABS = ['Overview', 'Inventory', 'Billing', 'Sales', 'Team', 'Settings'] as const;
type Tab = (typeof TABS)[number];

/** The open tab lives in the web address (#sales), so a refresh, a bookmark or the Back button returns to the same tab. */
const tabFromHash = (): Tab => TABS.find((t) => t.toLowerCase() === window.location.hash.slice(1).toLowerCase()) ?? 'Overview';
function useTab(): [Tab, (t: Tab) => void] {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [tab, (t) => { window.location.hash = t.toLowerCase(); }];
}

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { parts, loading, error, reload } = useParts();
  const [tab, setTab] = useTab();

  const [seed, setSeed] = useState<Query>(emptyQuery); // lets a row on Overview open Inventory already searching for that part
  const first = (profile?.full_name || profile?.email || '').split(/[ @]/)[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <div className="admin flex min-h-screen flex-col lg:flex-row">
          <aside className="sticky top-0 z-20 w-full shrink-0 border-b border-black/[0.06] bg-white/70 p-4 backdrop-blur-2xl lg:flex lg:h-screen lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:p-5">
            <div className="mb-3 flex items-center gap-2.5 lg:mb-8">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-[#2997ff] to-[#0071e3] text-sm font-bold text-white shadow-[0_2px_6px_rgba(0,113,227,0.35)]">S</span>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">Sunil Motors</div>
                <div className="text-[11px] text-[#86868b]">Garage &amp; spares</div>
              </div>
            </div>
            <AdminNav tabs={TABS} tab={tab} onPick={setTab} />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-black/[0.06] pt-4 text-sm text-[#6e6e73] lg:mt-auto lg:block lg:space-y-2">
              <Link to="/m" className="block underline decoration-black/20 underline-offset-2 hover:text-[#0071e3]">Mechanic view</Link>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-xs font-semibold text-[#0071e3]">{(first || profile?.email || '?').slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-[#1d1d1f]">{profile?.full_name || first}</span>
                  <span className="block truncate text-[11px]">{profile?.email}</span>
                </span>
              </div>
              <button onClick={signOut} className="underline decoration-black/20 underline-offset-2 hover:text-[#0071e3]">Sign out</button>
            </div>
          </aside>
          <main className="min-w-0 flex-1 space-y-5 p-4 lg:p-8">
            <ConfigWarning />
            <header>
              <p className="text-[13px] font-medium text-[#86868b]">{first ? `${greeting()}, ${first} · ` : ''}{today}</p>
              <h1 className="mt-1 text-[2.125rem] font-bold leading-tight tracking-[-0.035em] text-[#1d1d1f]">{tab}</h1>
              {tab === 'Overview' && !loading && <DailyNote parts={parts} />}
            </header>
            {error && <ErrorNote>We couldn't load your parts. Please check the internet and try again. ({error})</ErrorNote>}
            {loading && <p className="text-[#6e6e73]">Fetching your stock…</p>}
            <AnimatePresence mode="wait" initial={false}>
              <m.div key={tab} className="space-y-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
              {tab === 'Overview' && <Overview parts={parts} onOpenPart={(p) => { setSeed({ vehicle: '', part: p.sku, any: '' }); setTab('Inventory'); }} />}
              {tab === 'Inventory' && <Inventory parts={parts} reload={reload} initialQuery={seed} />}
              {tab === 'Billing' && <Billing parts={parts} reload={reload} />}
              {tab === 'Settings' && <SettingsPanel />}
              {tab === 'Sales' && <Sales parts={parts} />}
              {tab === 'Team' && <Team />}
              </m.div>
            </AnimatePresence>
          </main>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

/** One plain sentence about how the shop looks right now. */
function DailyNote({ parts }: { parts: Part[] }) {
  const out = parts.filter((p) => stockState(p) === 'out').length;
  const low = parts.filter((p) => stockState(p) === 'low').length;
  const bits = [out && `${out} ${out === 1 ? 'part is' : 'parts are'} out of stock`, low && `${low} ${low === 1 ? 'is' : 'are'} running low`].filter(Boolean);
  return (
    <p className="mt-1.5 max-w-xl text-[15px] text-[#6e6e73]">
      {parts.length === 0 ? "No parts yet. Add one, or use Bulk upload, and we'll get started." : bits.length ? `${bits.join(' and ')}. Worth a look before the next rush.` : 'Every part is well stocked. Nice work keeping the shelves full.'}
    </p>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function Overview({ parts, onOpenPart }: { parts: Part[]; onOpenPart: (p: Part) => void }) {
  const out = parts.filter((p) => stockState(p) === 'out');
  const low = parts.filter((p) => stockState(p) === 'low');
  const need = [...out, ...low];
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    parts.forEach((p) => map.set(p.category ?? 'Uncategorised', (map.get(p.category ?? 'Uncategorised') ?? 0) + p.quantity_available));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [parts]);

  const panel = 'card p-6';
  const enter = (i: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.25 + i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <>
      <StockKpis parts={parts} />
      <div className="grid gap-4 lg:grid-cols-2">
        <m.section className={panel} {...enter(0)}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold tracking-tight">Needs restocking</h2>
            {need.length > 0 && <span className="num text-xs text-[#86868b]">{Math.min(need.length, 12)} of {need.length}</span>}
          </div>
          <RestockList parts={need.slice(0, 12)} onOpen={onOpenPart} />
        </m.section>
        <m.section className={panel} {...enter(1)}>
          <h2 className="mb-4 font-bold tracking-tight">Units by category</h2>
          <CategoryBars data={byCat} />
        </m.section>
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

  const [removing, setRemoving] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!removing) return;
    setBusy(true); setErr(null); setNote(null);
    const { error } = await supabase.rpc('delete_user', { p_user_id: removing.id });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setNote(`${removing.full_name || removing.email} was removed. Their old sales and bills are still in your records.`);
      void load();
    }
    setRemoving(null);
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
      <p className="text-sm text-slate-500">Mechanics create their own account on the login page. Each person's name is used in the Sales list. Promote someone to admin, send a password reset link, or remove an account when someone leaves.</p>
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
              <button
                onClick={() => setRemoving(p)}
                disabled={p.id === me?.id || p.role === 'admin'}
                title={p.id === me?.id ? 'You cannot remove yourself' : p.role === 'admin' ? 'Change to Staff first' : 'Remove account'}
                className="h-11 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {removing && (
        <Modal title="Remove this account?" onClose={() => !busy && setRemoving(null)}>
          <p className="text-slate-700">
            <b>{removing.full_name || removing.email}</b> will no longer be able to sign in. Their past sales and bills stay in your records with their name.
          </p>
          <p className="mt-2 text-sm text-slate-500">This cannot be undone. They can create a new account later if needed.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setRemoving(null)} disabled={busy} className="h-11 rounded-lg border px-4 font-semibold">Cancel</button>
            <button onClick={remove} disabled={busy} className="h-11 rounded-lg bg-red-600 px-4 font-semibold text-white disabled:opacity-60">{busy ? 'Removing…' : 'Remove account'}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
