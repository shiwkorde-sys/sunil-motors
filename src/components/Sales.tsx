import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';
import type { Checkout } from '../lib/types';
import { ErrorNote, inputCls } from './ui';

type Range = 'today' | 'week' | 'month' | 'all' | 'custom';
const ymd = (d: Date) => d.toLocaleDateString('en-CA'); // yyyy-mm-dd, local (India) day
const startOf = (s: string) => new Date(s + 'T00:00:00');

/** Every part that left the shop (mechanic checkouts and counter sales). Read-only history. */
export default function Sales() {
  const [range, setRange] = useState<Range>('today');
  const [from, setFrom] = useState(ymd(new Date()));
  const [to, setTo] = useState(ymd(new Date()));
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Checkout[]>([]);
  const [bills, setBills] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const today = new Date();
    let a: Date | null = null;
    let b: Date | null = null;
    if (range === 'today') a = startOf(ymd(today));
    else if (range === 'week') a = new Date(startOf(ymd(today)).getTime() - 6 * 86400000);
    else if (range === 'month') a = new Date(today.getFullYear(), today.getMonth(), 1);
    else if (range === 'custom') {
      a = startOf(from);
      b = new Date(startOf(to).getTime() + 86400000);
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      let qy = supabase.from('checkout_transactions').select('*').order('created_at', { ascending: false }).limit(1000);
      if (a) qy = qy.gte('created_at', a.toISOString());
      if (b) qy = qy.lt('created_at', b.toISOString());
      const { data, error } = await qy;
      if (!alive) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      const list = data as Checkout[];
      setRows(list);
      // Which of these are already on a bill? (Only admins can read bills; this screen is admin-only.)
      const ids = list.map((r) => r.id);
      const map: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data: its } = await supabase.from('invoice_items').select('checkout_id, invoices(invoice_number)').in('checkout_id', ids.slice(i, i + 150));
        (its as unknown as { checkout_id: string; invoices: { invoice_number: string } | null }[] | null)?.forEach((x) => x.invoices && (map[x.checkout_id] = x.invoices.invoice_number));
      }
      if (alive) {
        setBills(map);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range, from, to]);

  const shown = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => {
      const hay = [r.part_name, r.sku, r.vehicle_registration, r.mechanic_name, r.job_reference].join(' ').toLowerCase().replace(/\s+/g, ' ');
      const hayNoSpace = hay.replace(/ /g, '');
      return words.every((w) => hay.includes(w) || hayNoSpace.includes(w)); // "mh12ab" also matches "MH 12 AB 1234"
    });
  }, [rows, text]);

  const units = shown.reduce((n, r) => n + r.quantity, 0);
  const chips: [Range, string][] = [['today', 'Today'], ['week', 'Last 7 days'], ['month', 'This month'], ['all', 'All'], ['custom', 'Pick dates']];

  return (
    <>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(([k, label]) => (
            <button key={k} onClick={() => setRange(k)} aria-pressed={range === k} className={`h-10 rounded-full border px-4 text-sm font-semibold ${range === k ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'}`}>
              {label}
            </button>
          ))}
          {range === 'custom' && (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <input type="date" max={ymd(new Date())} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-10 rounded-xl border border-slate-300 px-3" aria-label="From date" />
              to
              <input type="date" max={ymd(new Date())} value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-10 rounded-xl border border-slate-300 px-3" aria-label="To date" />
            </span>
          )}
        </div>
        <input className={inputCls} placeholder="Search by part name, SKU, vehicle number, mechanic or job…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search sales" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500" aria-live="polite">
          {loading ? 'Loading…' : `${shown.length} sale${shown.length === 1 ? '' : 's'} · ${units} part${units === 1 ? '' : 's'} sold`}
          {rows.length >= 1000 && ' · showing the latest 1,000, narrow the dates to see others'}
          <span className="ml-2">Read-only history. Entries cannot be edited or deleted.</span>
        </p>
        <button onClick={() => downloadCsv('sales.csv', shown.map((r) => ({ ...r, bill: bills[r.id] ?? '' })))} disabled={!shown.length} className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm disabled:opacity-50">
          Export CSV
        </button>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{['When', 'Part', 'Qty', 'Mechanic', 'Vehicle', 'Job ref', 'Bill'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {!loading && shown.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No sales for this choice.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-2">{r.part_name} <span className="text-xs text-slate-400">{r.sku}</span></td>
                <td className="px-4 py-2">{r.quantity}</td>
                <td className="px-4 py-2">{r.mechanic_name}</td>
                <td className="px-4 py-2 font-mono">{r.vehicle_registration ?? '-'}</td>
                <td className="px-4 py-2">{r.job_reference}</td>
                <td className="px-4 py-2">{bills[r.id] ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">{bills[r.id]}</span> : <span className="text-xs text-slate-400">Not billed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
