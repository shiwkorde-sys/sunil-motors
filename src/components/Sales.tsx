import { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';
import type { Checkout, Part } from '../lib/types';
import DateRangePicker, { type DateRange } from './DateRangePicker';
import { CountUp, stagger } from './motion';
import { ErrorNote, inputCls } from './ui';

const ymd = (d: Date) => d.toLocaleDateString('en-CA');
const startOf = (s: string) => new Date(s + 'T00:00:00');
const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const rupee2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const shortName = (s: string) => s.replace(/\s*\(.*?\)\s*/g, ' ').trim();

interface Billed {
  no: string;
  unit: number;
  amount: number;
}
interface Sale extends Checkout {
  billed: Billed | null;
  unit: number; // price per piece: the billed price, or today's list price if there is no bill
  amount: number; // quantity x price
}

/** Every part that left the shop (mechanic checkouts and counter sales) with what it is worth. Read-only. */
export default function Sales({ parts }: { parts: Part[] }) {
  const [range, setRange] = useState<DateRange>({ from: ymd(new Date()), to: ymd(new Date()) });
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Checkout[]>([]);
  const [bills, setBills] = useState<Record<string, Billed>>({});
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
      const ids = list.map((r) => r.id);
      const map: Record<string, Billed> = {};
      for (let i = 0; i < ids.length; i += 150) {
        const { data: its } = await supabase.from('invoice_items').select('checkout_id, unit_price, line_total, invoices(invoice_number)').in('checkout_id', ids.slice(i, i + 150));
        (its as unknown as { checkout_id: string; unit_price: string; line_total: string; invoices: { invoice_number: string } | null }[] | null)?.forEach(
          (x) => x.invoices && (map[x.checkout_id] = { no: x.invoices.invoice_number, unit: Number(x.unit_price), amount: Number(x.line_total) }),
        );
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

  const listPrice = useMemo(() => new Map(parts.map((p) => [p.id, p.price ?? 0])), [parts]);
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);

  const sales: Sale[] = useMemo(
    () =>
      rows.map((r) => {
        const billed = bills[r.id] ?? null;
        const unit = billed ? billed.unit : listPrice.get(r.part_id) ?? 0;
        return { ...r, billed, unit, amount: billed ? billed.amount : unit * r.quantity };
      }),
    [rows, bills, listPrice],
  );

  const shown = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return sales;
    return sales.filter((r) => {
      const hay = [r.part_name, r.sku, r.vehicle_registration, r.mechanic_name, r.job_reference, r.billed?.no].join(' ').toLowerCase();
      const flat = hay.replace(/\s+/g, '');
      return words.every((w) => hay.includes(w) || flat.includes(w)); // "mh12ab" also finds "MH 12 AB 1234"
    });
  }, [sales, text]);

  const k = useMemo(() => {
    const total = shown.reduce((n, r) => n + r.amount, 0);
    const billed = shown.filter((r) => r.billed).reduce((n, r) => n + r.amount, 0);
    const unbilled = total - billed;
    const units = shown.reduce((n, r) => n + r.quantity, 0);
    const vehicles = new Set(shown.map((r) => r.vehicle_registration).filter(Boolean)).size;

    const mech = new Map<string, { amount: number; sales: number; units: number; vehicles: Set<string> }>();
    const part = new Map<string, number>();
    const sold = new Map<string, number>();
    shown.forEach((r) => {
      const m = mech.get(r.mechanic_name) ?? { amount: 0, sales: 0, units: 0, vehicles: new Set<string>() };
      m.amount += r.amount;
      m.sales += 1;
      m.units += r.quantity;
      if (r.vehicle_registration) m.vehicles.add(r.vehicle_registration);
      mech.set(r.mechanic_name, m);
      part.set(r.part_name, (part.get(r.part_name) ?? 0) + r.quantity);
      sold.set(r.part_id, (sold.get(r.part_id) ?? 0) + r.quantity);
    });
    const topMech = [...mech.entries()].sort((a, b) => b[1].amount - a[1].amount || b[1].sales - a[1].sales)[0];
    const topPart = [...part.entries()].sort((a, b) => b[1] - a[1])[0];
    const low = [...sold.keys()].map((id) => byId.get(id)).filter((p): p is Part => !!p && p.quantity_available <= p.min_stock).sort((a, b) => a.quantity_available - b.quantity_available);
    const billedPct = total > 0 ? Math.round((billed / total) * 100) : 0;
    return {
      total, billed, unbilled, units, vehicles, billedPct, unbilledPct: total > 0 ? 100 - billedPct : 0,
      unpriced: shown.filter((r) => !r.billed && r.unit === 0).length,
      topMech: topMech && { name: topMech[0], ...topMech[1], vehicles: topMech[1].vehicles.size, pct: total > 0 ? Math.round((topMech[1].amount / total) * 100) : 0 },
      topPart, low,
    };
  }, [shown, byId]);

  const [grow, setGrow] = useState(false);
  useEffect(() => {
    setGrow(false);
    const t = requestAnimationFrame(() => setGrow(true));
    return () => cancelAnimationFrame(t);
  }, [k.billedPct, loading]);

  const empty = !loading && shown.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-slate-500">Every part that left the shop. Choose a period to see how you did.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <DateRangePicker value={range} onChange={setRange} />
        <input className={inputCls + ' min-w-0 flex-1 sm:min-w-[18rem]'} placeholder="Find a vehicle, mechanic, part or bill…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search sales" />
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}

      {/* ───── Key numbers: all of them follow the date and search above ───── */}
      <section aria-label="Key numbers" className={`grid gap-3 transition-opacity lg:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
        <article className="anim-up relative overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-sm lg:col-span-2" style={stagger(0)}>
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
          <div className="text-sm font-medium text-white/80">Total sales</div>
          <div className="mt-1 font-display text-5xl font-bold leading-none tracking-tight"><CountUp value={k.total} format={rupee} /></div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            <span>{plural(shown.length, 'sale')}</span>
            <span>{plural(k.units, 'part')}</span>
            <span>{plural(k.vehicles, 'vehicle')}</span>
          </div>
          <p className="mt-3 text-xs text-white/70">Includes sales without a bill. Those are valued at today's list price.</p>
        </article>

        <article className="anim-up rounded-3xl bg-white p-5 shadow-sm lg:col-span-2" style={stagger(1)}>
          <div className="text-sm font-medium text-slate-500">Top seller</div>
          {k.topMech ? (
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-100 font-display text-2xl font-bold text-brand" aria-hidden="true">{k.topMech.name.trim().charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold">{k.topMech.name}</div>
                <div className="text-slate-700"><b className="font-display text-2xl"><CountUp value={k.topMech.amount} format={rupee} /></b> <span className="text-slate-500">· {k.topMech.pct}% of all sales</span></div>
                <div className="text-sm text-slate-500">{plural(k.topMech.sales, 'sale')} · {plural(k.topMech.vehicles, 'vehicle')} · {plural(k.topMech.units, 'part')}</div>
              </div>
            </div>
          ) : <p className="mt-3 text-slate-400">No sales to compare yet.</p>}
        </article>

        <article className="anim-up rounded-3xl bg-white p-5 shadow-sm lg:col-span-2" style={stagger(2)}>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-medium text-slate-500">Billed and not billed</div>
            {k.total > 0 && <div className="text-xs text-slate-400">share of total sales</div>}
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${k.billedPct}% billed, ${k.unbilledPct}% not billed`}>
            <div className="h-full bg-green-500 transition-[width] duration-700 ease-out" style={{ width: grow ? `${k.billedPct}%` : '0%' }} />
            <div className="h-full bg-amber-400 transition-[width] duration-700 ease-out" style={{ width: grow ? `${k.unbilledPct}%` : '0%' }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Billed · {k.billedPct}%</div>
              <div className="font-display text-2xl font-bold"><CountUp value={k.billed} format={rupee} /></div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Not billed · {k.unbilledPct}%</div>
              <div className="font-display text-2xl font-bold"><CountUp value={k.unbilled} format={rupee} /></div>
            </div>
          </div>
          {k.unpriced > 0 && <p className="mt-2 text-xs text-amber-700">{plural(k.unpriced, 'sale')} {k.unpriced === 1 ? 'has' : 'have'} no price yet, so {k.unpriced === 1 ? 'it is' : 'they are'} counted as ₹0. Add prices in Inventory.</p>}
        </article>

        <article className="anim-up rounded-3xl bg-white p-5 shadow-sm" style={stagger(3)}>
          <div className="text-sm font-medium text-slate-500">Most sold part</div>
          {k.topPart ? (
            <>
              <div className="mt-1 line-clamp-2 text-lg font-bold leading-snug" title={k.topPart[0]}>{shortName(k.topPart[0])}</div>
              <div className="text-slate-500"><b className="font-display text-2xl text-slate-900"><CountUp value={k.topPart[1]} /></b> sold</div>
            </>
          ) : <p className="mt-2 text-slate-400">-</p>}
        </article>

        <article className="anim-up rounded-3xl bg-white p-5 shadow-sm" style={stagger(4)}>
          <div className="text-sm font-medium text-slate-500">Reorder soon</div>
          <div className={`mt-1 font-display text-3xl font-bold ${k.low.length ? 'text-amber-600' : 'text-green-600'}`}><CountUp value={k.low.length} /> <span className="text-base font-medium text-slate-500">{k.low.length === 1 ? 'part' : 'parts'}</span></div>
          <p className="text-xs text-slate-500">{k.low.length ? `Sold here and nearly out: ${k.low.slice(0, 2).map((p) => `${shortName(p.name)} (${p.quantity_available} left)`).join(', ')}${k.low.length > 2 ? ` +${k.low.length - 2} more` : ''}` : 'Everything you sold here is well stocked.'}</p>
        </article>
      </section>

      {/* ───── The list ───── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500" aria-live="polite">
          {loading ? 'Loading sales…' : `${plural(shown.length, 'sale')} shown`}
          {rows.length >= 1000 && ' (latest 1,000. Choose fewer days to see the rest.)'}
          <span className="ml-2 text-slate-400">History is read-only.</span>
        </p>
        <button
          onClick={() => downloadCsv('sales.csv', shown.map((r) => ({ vehicle: r.vehicle_registration ?? '', mechanic: r.mechanic_name, date: new Date(r.created_at).toLocaleString('en-IN'), part: r.part_name, sku: r.sku, quantity: r.quantity, price: r.unit, amount: r.amount, bill: r.billed?.no ?? '', job: r.job_reference })))}
          disabled={!shown.length}
          className="h-10 rounded-xl bg-white px-4 text-sm font-semibold shadow-sm active:scale-95 disabled:opacity-50"
        >
          Download as spreadsheet
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
              {['Vehicle', 'Mechanic', 'When', 'Part', 'Qty', 'Price', 'Amount', 'Bill'].map((h, i) => <th key={h} className={`px-4 py-3 font-semibold ${i >= 4 && i <= 6 ? 'text-right' : ''}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {empty && (
              <tr><td colSpan={8} className="px-4 py-14 text-center text-slate-500">
                <div className="font-semibold text-slate-700">No sales here</div>
                <div className="text-sm">Try another period, or clear the search.</div>
              </td></tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id} className="anim-up hover:bg-slate-50/70" style={stagger(Math.min(i, 5))}>
                <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold">{r.vehicle_registration ?? <span className="font-sans font-normal text-slate-300">none</span>}</td>
                <td className="whitespace-nowrap px-4 py-3">{r.mechanic_name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="px-4 py-3">{r.part_name}<div className="text-xs text-slate-400">{r.sku}</div></td>
                <td className="px-4 py-3 text-right">{r.quantity}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{r.unit ? rupee2(r.unit) : <span className="text-amber-600">no price</span>}{!r.billed && r.unit > 0 && <span title="List price today, because there is no bill" className="ml-0.5 text-slate-300">*</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{rupee2(r.amount)}</td>
                <td className="whitespace-nowrap px-4 py-3">{r.billed ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">{r.billed.no}</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">No bill</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">* No bill was made, so the price shown is today's list price. Billed sales show the price actually charged, with GST if it was added.</p>
    </div>
  );
}
