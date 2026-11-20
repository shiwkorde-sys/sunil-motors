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

  const [showStats, setShowStats] = useState(() => {
    try {
      return localStorage.getItem('sales-stats') !== 'hidden';
    } catch {
      return true;
    }
  });
  const toggleStats = () =>
    setShowStats((v) => {
      try {
        localStorage.setItem('sales-stats', v ? 'hidden' : 'shown');
      } catch {
        /* private mode: fine, it just will not be remembered */
      }
      return !v;
    });
  const [grow, setGrow] = useState(false);
  useEffect(() => {
    setGrow(false);
    const t = requestAnimationFrame(() => setGrow(true));
    return () => cancelAnimationFrame(t);
  }, [k.billedPct, loading]);

  const empty = !loading && shown.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <DateRangePicker value={range} onChange={setRange} />
        <input className={inputCls + ' min-w-0 flex-1 sm:min-w-[18rem]'} placeholder="Find a vehicle, mechanic, part or bill…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search sales" />
        <button onClick={toggleStats} aria-expanded={showStats} className="h-11 shrink-0 rounded-xl bg-slate-100 px-4 text-sm font-semibold hover:bg-slate-200 active:scale-95">
          {showStats ? 'Hide stats' : 'Show stats'}
        </button>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}

      {/* ───── Stats: one slim strip. Hide it when you only want the list. ───── */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${showStats ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <section aria-label="Key numbers" className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 shadow-sm transition-opacity lg:grid-cols-5 ${loading ? 'opacity-60' : ''}`}>
            <Stat label="Total sales" sub={`${plural(shown.length, 'sale')} · ${plural(k.units, 'part')} · ${plural(k.vehicles, 'vehicle')}`} strong>
              <CountUp value={k.total} format={rupee} />
            </Stat>
            <Stat label="Billed" sub={`${k.billedPct}% of sales`}>
              <span className="text-green-700"><CountUp value={k.billed} format={rupee} /></span>
            </Stat>
            <Stat label="Not billed" sub={`${k.unbilledPct}% of sales${k.unpriced ? ` · ${k.unpriced} without price` : ''}`}>
              <span className={k.unbilled ? 'text-amber-600' : ''}><CountUp value={k.unbilled} format={rupee} /></span>
            </Stat>
            <Stat label="Top seller" sub={k.topMech ? `${k.topMech.pct}% · ${plural(k.topMech.vehicles, 'vehicle')} · ${plural(k.topMech.units, 'part')}` : 'no sales yet'} title={k.topMech?.name}>
              {k.topMech ? <><span className="block truncate text-base font-bold">{k.topMech.name}</span><CountUp value={k.topMech.amount} format={rupee} /></> : '–'}
            </Stat>
            <Stat label="Most sold part" sub={k.topPart ? `${k.topPart[1]} sold` : 'no sales yet'} title={k.topPart?.[0]}>
              {k.topPart ? <span className="line-clamp-2 text-base font-bold leading-tight">{shortName(k.topPart[0])}</span> : '–'}
            </Stat>
            <div className="col-span-2 bg-white px-4 pb-3 lg:col-span-5">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${k.billedPct}% billed, ${k.unbilledPct}% not billed`}>
                <div className="h-full bg-green-500 transition-[width] duration-700 ease-out" style={{ width: grow ? `${k.billedPct}%` : '0%' }} />
                <div className="h-full bg-amber-400 transition-[width] duration-700 ease-out" style={{ width: grow ? `${k.unbilledPct}%` : '0%' }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Sales without a bill use today's list price.
                {k.low.length > 0 && <span className="ml-2 font-medium text-amber-700">Reorder soon: {k.low.slice(0, 3).map((p) => `${shortName(p.name)} (${p.quantity_available} left)`).join(', ')}{k.low.length > 3 ? ` +${k.low.length - 3}` : ''}</span>}
              </p>
            </div>
          </section>
        </div>
      </div>
      {!showStats && (
        <p className="px-1 text-sm text-slate-500">
          <b className="text-slate-800"><CountUp value={k.total} format={rupee} /></b> total · {plural(shown.length, 'sale')} · {k.unbilledPct}% not billed
        </p>
      )}

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

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
              {['Vehicle', 'Mechanic', 'When', 'Part', 'Qty', 'Price', 'Amount', 'Bill'].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i >= 4 && i <= 6 ? 'text-right' : ''}`}>{h}</th>)}
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
                <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold">{r.vehicle_registration ?? <span className="font-sans font-normal text-slate-300">none</span>}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.mechanic_name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td className="px-3 py-2">{r.part_name}<div className="text-xs text-slate-400">{r.sku}</div></td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-600">{r.unit ? rupee2(r.unit) : <span className="text-amber-600">no price</span>}{!r.billed && r.unit > 0 && <span title="List price today, because there is no bill" className="ml-0.5 text-slate-300">*</span>}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{rupee2(r.amount)}</td>
                <td className="whitespace-nowrap px-3 py-2">{r.billed ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">{r.billed.no}</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">No bill</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">* No bill was made, so the price shown is today's list price. Billed sales show the price actually charged, with GST if it was added.</p>
    </div>
  );
}

function Stat({ label, sub, children, strong = false, title }: { label: string; sub: string; children: React.ReactNode; strong?: boolean; title?: string }) {
  return (
    <div className="min-w-0 bg-white px-4 py-3" title={title}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`font-display font-bold leading-tight ${strong ? 'text-3xl text-brand' : 'text-2xl'}`}>{children}</div>
      <div className="truncate text-xs text-slate-500">{sub}</div>
    </div>
  );
}
