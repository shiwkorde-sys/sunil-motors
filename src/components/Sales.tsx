import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';
import type { Checkout } from '../lib/types';
import type { Part } from '../lib/types';
import DateRangePicker, { type DateRange } from './DateRangePicker';
import { ErrorNote, inputCls } from './ui';

const ymd = (d: Date) => d.toLocaleDateString('en-CA'); // yyyy-mm-dd, local (India) day
const startOf = (s: string) => new Date(s + 'T00:00:00');
const inr0 = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

/** Every part that left the shop (mechanic checkouts and counter sales). Read-only history. */
export default function Sales({ parts }: { parts: Part[] }) {
  const [range, setRange] = useState<DateRange>({ from: ymd(new Date()), to: ymd(new Date()) });
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Checkout[]>([]);
  const [bills, setBills] = useState<Record<string, { no: string; amount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const a = range.from ? startOf(range.from) : null;
    const b = range.to ? new Date(startOf(range.to).getTime() + 86400000) : null;
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
      const map: Record<string, { no: string; amount: number }> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data: its } = await supabase.from('invoice_items').select('checkout_id, line_total, invoices(invoice_number)').in('checkout_id', ids.slice(i, i + 150));
        (its as unknown as { checkout_id: string; line_total: string; invoices: { invoice_number: string } | null }[] | null)?.forEach((x) => x.invoices && (map[x.checkout_id] = { no: x.invoices.invoice_number, amount: Number(x.line_total) }));
      }
      if (alive) {
        setBills(map);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [range]);

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
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const price = useMemo(() => new Map(parts.map((p) => [p.id, p.price ?? 0])), [parts]);
  const k = useMemo(() => {
    const billed = shown.filter((r) => bills[r.id]);
    const unbilled = shown.filter((r) => !bills[r.id]);
    const top = (key: (r: Checkout) => string, weight: (r: Checkout) => number) => {
      const m = new Map<string, number>();
      shown.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + weight(r)));
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    };
    return {
      revenue: billed.reduce((n, r) => n + bills[r.id].amount, 0),
      billed: billed.length,
      unbilled: unbilled.length,
      unbilledValue: unbilled.reduce((n, r) => n + r.quantity * (price.get(r.part_id) ?? 0), 0),
      topPart: top((r) => r.part_name, (r) => r.quantity),
      topMechanic: top((r) => r.mechanic_name, () => 1),
      // parts that sold in this filter and are now at or below their minimum stock (best sellers first)
      restock: (() => {
        const sold = new Map<string, number>();
        shown.forEach((r) => sold.set(r.part_id, (sold.get(r.part_id) ?? 0) + r.quantity));
        return [...sold.entries()]
          .map(([id, n]) => ({ part: byId.get(id), n }))
          .filter((x): x is { part: Part; n: number } => !!x.part && x.part.quantity_available <= x.part.min_stock)
          .sort((a, b) => b.n - a.n);
      })(),
      vehicles: new Set(shown.map((r) => r.vehicle_registration).filter(Boolean)).size,
    };
  }, [shown, bills, price, byId]);

  return (
    <>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker value={range} onChange={setRange} />
          <input className={inputCls + ' min-w-0 flex-1 sm:min-w-[18rem]'} placeholder="Search part, SKU, vehicle number, mechanic or job…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search sales" />
        </div>
      </div>

      <section aria-label="Key numbers for this filter" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Billed revenue" value={inr0(k.revenue)} note={`${k.billed} billed sale${k.billed === 1 ? '' : 's'}`} tone="brand" />
        <Kpi label="Sales" value={String(shown.length)} note={`${units} part${units === 1 ? '' : 's'} sold`} />
        <Kpi label="Not billed yet" value={String(k.unbilled)} note={k.unbilled ? `about ${inr0(k.unbilledValue)} at list price` : 'all sales are billed'} tone={k.unbilled ? 'warn' : 'ok'} />
        <Kpi label="Top part" value={k.topPart ? k.topPart[0] : '-'} note={k.topPart ? `${k.topPart[1]} sold` : ''} small />
        <Kpi label="Busiest mechanic" value={k.topMechanic ? k.topMechanic[0] : '-'} note={k.topMechanic ? `${k.topMechanic[1]} sale${k.topMechanic[1] === 1 ? '' : 's'}` : ''} small />
        <Kpi label="Restock soon" value={String(k.restock.length)} tone={k.restock.length ? 'warn' : 'ok'} note={k.restock.length ? k.restock.slice(0, 2).map((x) => `${x.part.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()} (${x.part.quantity_available} left)`).join(', ') + (k.restock.length > 2 ? ` +${k.restock.length - 2} more` : '') : 'sold parts are well stocked'} />
        <Kpi label="Vehicles served" value={String(k.vehicles)} note="different vehicle numbers" />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500" aria-live="polite">
          {loading ? 'Loading…' : `Showing ${shown.length} of ${rows.length}`}
          {rows.length >= 1000 && ' · showing the latest 1,000, narrow the dates to see others'}
          <span className="ml-2">Read-only history. Entries cannot be edited or deleted.</span>
        </p>
        <button onClick={() => downloadCsv('sales.csv', shown.map((r) => ({ ...r, bill: bills[r.id]?.no ?? '' })))} disabled={!shown.length} className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm disabled:opacity-50">
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
                <td className="px-4 py-2">{bills[r.id] ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">{bills[r.id].no}</span> : <span className="text-xs text-slate-400">Not billed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({ label, value, note, tone, small = false }: { label: string; value: string; note?: string; tone?: 'brand' | 'warn' | 'ok'; small?: boolean }) {
  const color = tone === 'brand' ? 'text-brand' : tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-green-700' : 'text-slate-900';
  return (
    <div className="anim-up min-w-0 rounded-2xl bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-display font-bold leading-tight ${color} ${small ? 'line-clamp-2 text-xl' : 'text-3xl'}`} title={value}>{value}</div>
      {note && <div className="mt-0.5 text-xs text-slate-500">{note}</div>}
    </div>
  );
}
