import { useEffect, useMemo, useState } from 'react';
import { calcLine, inr, toInvoice, toItem } from '../lib/invoice';
import { emptyQuery, searchParts } from '../lib/search';
import { supabase } from '../lib/supabase';
import type { Checkout, CompanySettings, Invoice, InvoiceItem, Part } from '../lib/types';
import InvoiceView from './InvoiceView';
import { ErrorNote, Field, inputCls } from './ui';

interface Line {
  key: string;
  part_id: string | null;
  checkout_id: string | null;
  sku: string;
  name: string;
  qty: number;
  price: number;
  rate: number;
  fixedQty: boolean; // from a checkout: quantity was already taken from stock
  stock: number | null;
}

export default function Billing({ parts, reload }: { parts: Part[]; reload: () => void }) {
  const [mode, setMode] = useState<'new' | 'history'>('new');
  const [open, setOpen] = useState<{ inv: Invoice; items: InvoiceItem[] } | null>(null);
  return (
    <>
      <div className="flex gap-2">
        {(['new', 'history'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`h-11 rounded-xl px-5 font-semibold ${mode === m ? 'bg-slate-900 text-white' : 'bg-white shadow-sm'}`}>
            {m === 'new' ? 'New bill' : 'Past bills'}
          </button>
        ))}
      </div>
      {mode === 'new' ? <NewBill parts={parts} reload={reload} onCreated={(inv, items) => setOpen({ inv, items })} /> : <History onOpen={(inv, items) => setOpen({ inv, items })} />}
      {open && <InvoiceView inv={open.inv} items={open.items} onClose={() => setOpen(null)} />}
    </>
  );
}

function NewBill({ parts, reload, onCreated }: { parts: Part[]; reload: () => void; onCreated: (inv: Invoice, items: InvoiceItem[]) => void }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [cust, setCust] = useState({ name: '', phone: '', vehicle: '', gstin: '' });
  const [gst, setGst] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [find, setFind] = useState('');
  const [pending, setPending] = useState<Checkout[]>([]);
  const [vehFilter, setVehFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPending() {
    const [co, billed] = await Promise.all([
      supabase.from('checkout_transactions').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('invoice_items').select('checkout_id').not('checkout_id', 'is', null),
    ]);
    if (co.error) return setErr(co.error.message);
    const done = new Set((billed.data ?? []).map((r) => r.checkout_id as string));
    setPending((co.data as Checkout[]).filter((c) => !done.has(c.id)));
  }

  useEffect(() => {
    supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error) return setErr(error.message + '. Has the invoices update been applied to the database?');
      const s = { ...(data as CompanySettings), default_gst_rate: Number(data.default_gst_rate) };
      setSettings(s);
      setGst(s.gst_default_on);
    });
    loadPending();
  }, []);

  const rate0 = settings?.default_gst_rate ?? 18;
  const incl = settings?.prices_include_gst ?? true;
  const partById = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const matches = useMemo(() => (find.trim() ? searchParts(parts, { ...emptyQuery, any: find }).slice(0, 8) : []), [parts, find]);
  const shownPending = pending.filter((c) => !lines.some((l) => l.checkout_id === c.id) && (!vehFilter.trim() || (c.vehicle_registration ?? '').includes(vehFilter.trim().toUpperCase().replace(/\s/g, ''))));

  const addPart = (p: Part) => {
    setFind('');
    setLines((ls) => {
      const ex = ls.find((l) => l.part_id === p.id && !l.checkout_id);
      if (ex) return ls.map((l) => (l === ex ? { ...l, qty: Math.min(l.qty + 1, p.quantity_available) } : l));
      return [...ls, { key: crypto.randomUUID(), part_id: p.id, checkout_id: null, sku: p.sku, name: p.name, qty: 1, price: p.price ?? 0, rate: rate0, fixedQty: false, stock: p.quantity_available }];
    });
  };
  const addCheckout = (c: Checkout) => {
    const p = partById.get(c.part_id);
    setLines((ls) => [...ls, { key: crypto.randomUUID(), part_id: c.part_id, checkout_id: c.id, sku: c.sku, name: c.part_name, qty: c.quantity, price: p?.price ?? 0, rate: rate0, fixedQty: true, stock: null }]);
    if (!cust.vehicle && c.vehicle_registration) setCust((x) => ({ ...x, vehicle: c.vehicle_registration! }));
  };
  const patch = (key: string, ch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...ch } : l)));

  const calc = lines.map((l) => calcLine(l.qty, l.price, l.rate, gst, incl));
  const sub = calc.reduce((a, c) => a + c.taxable, 0);
  const tax = calc.reduce((a, c) => a + c.tax, 0);
  const total = calc.reduce((a, c) => a + c.total, 0);

  async function create() {
    setErr(null);
    if (!lines.length) return setErr('Add at least one part.');
    if (lines.some((l) => !(l.price > 0))) return setErr('Every part needs a price. Type it in the Price box.');
    if (gst && !settings?.gstin) return setErr('Add your GST number in Settings first, or untick "Add GST".');
    setBusy(true);
    const { data, error } = await supabase.rpc('create_invoice', {
      p_customer: { name: cust.name, phone: cust.phone, vehicle_registration: cust.vehicle, gstin: cust.gstin },
      p_items: lines.map((l) => (l.checkout_id ? { checkout_id: l.checkout_id, unit_price: l.price, gst_rate: l.rate } : { part_id: l.part_id, quantity: l.qty, unit_price: l.price, gst_rate: l.rate })),
      p_gst_enabled: gst,
    });
    if (error) {
      setBusy(false);
      return setErr(error.message);
    }
    const inv = toInvoice(data as Record<string, unknown>);
    const { data: its } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('id');
    setBusy(false);
    onCreated(inv, (its ?? []).map((r) => toItem(r)));
    setLines([]);
    setCust({ name: '', phone: '', vehicle: '', gstin: '' });
    loadPending();
    reload();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Customer</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name (optional)"><input className={inputCls} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></Field>
            <Field label="Phone (optional)"><input className={inputCls} inputMode="tel" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} /></Field>
            <Field label="Vehicle number (optional)"><input className={inputCls} value={cust.vehicle} onChange={(e) => setCust({ ...cust, vehicle: e.target.value.toUpperCase() })} /></Field>
            {gst && <Field label="Customer GST number (optional)"><input className={inputCls} value={cust.gstin} onChange={(e) => setCust({ ...cust, gstin: e.target.value.toUpperCase() })} /></Field>}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Add parts</h2>
          <div className="relative">
            <input className={inputCls} placeholder="Search your stock: type a part name or SKU…" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a part to add" />
            {matches.length > 0 && (
              <ul className="anim-scale absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-300 bg-white shadow-lg">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button onClick={() => addPart(p)} disabled={p.quantity_available === 0} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block text-xs text-slate-500">{p.sku} · {p.quantity_available} in stock</span>
                      </span>
                      <span className="shrink-0 font-semibold">{p.price ? inr(p.price) : 'no price'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details open={pending.length > 0} className="rounded-xl bg-slate-50 p-3">
            <summary className="cursor-pointer font-medium">Mechanic checkouts not yet billed ({pending.length})</summary>
            <p className="mt-1 text-xs text-slate-500">Stock was already taken when the mechanic checked out, so adding these will not reduce stock again.</p>
            <input className={inputCls + ' mt-2'} placeholder="Filter by vehicle number" value={vehFilter} onChange={(e) => setVehFilter(e.target.value)} aria-label="Filter checkouts by vehicle" />
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-auto">
              {shownPending.length === 0 && <li className="py-2 text-sm text-slate-500">Nothing to bill.</li>}
              {shownPending.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{c.quantity} × {c.part_name}</span>
                    <span className="block truncate text-xs text-slate-500">{c.mechanic_name} · {c.vehicle_registration ?? 'no vehicle'} · {new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                  </span>
                  <button onClick={() => addCheckout(c)} className="h-10 shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Add</button>
                </li>
              ))}
            </ul>
          </details>
        </section>

        <section className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>{['Part', 'Qty', 'Price', ...(gst ? ['GST %'] : []), 'Amount', ''].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {lines.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No parts added yet.</td></tr>}
              {lines.map((l, i) => (
                <tr key={l.key} className="anim-up align-middle">
                  <td className="px-3 py-2"><div className="font-medium">{l.name}</div><div className="text-xs text-slate-400">{l.sku}{l.fixedQty ? ' · from checkout' : ''}</div></td>
                  <td className="px-3 py-2">
                    {l.fixedQty ? l.qty : <input type="number" min={1} max={l.stock ?? undefined} className="h-10 w-16 rounded-lg border border-slate-300 px-2" value={l.qty} onChange={(e) => patch(l.key, { qty: Math.max(1, Math.min(l.stock ?? 9999, Math.floor(Number(e.target.value) || 1))) })} />}
                  </td>
                  <td className="px-3 py-2"><input type="number" min={0} step="0.01" className={`h-10 w-24 rounded-lg border px-2 ${l.price > 0 ? 'border-slate-300' : 'border-amber-400 bg-amber-50'}`} value={l.price || ''} placeholder="0" onChange={(e) => patch(l.key, { price: Math.max(0, Number(e.target.value) || 0) })} /></td>
                  {gst && <td className="px-3 py-2"><input type="number" min={0} max={100} step="0.5" className="h-10 w-16 rounded-lg border border-slate-300 px-2" value={l.rate} onChange={(e) => patch(l.key, { rate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></td>}
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{inr(calc[i].total)}</td>
                  <td className="px-3 py-2"><button onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`Remove ${l.name}`} className="h-10 w-10 text-2xl text-slate-400">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-2xl bg-white p-4 shadow-sm xl:sticky xl:top-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={gst} onChange={(e) => setGst(e.target.checked)} />
          <span className="font-semibold">Add GST (tax invoice)</span>
        </label>
        {gst && <p className="text-xs text-slate-500">{incl ? 'Prices include GST; the tax is shown inside the total.' : 'GST is added on top of the prices.'}</p>}
        <div className="space-y-1 border-t pt-3 text-sm">
          {gst && <><R l="Taxable value" r={inr(sub)} /><R l="CGST" r={inr(tax / 2)} /><R l="SGST" r={inr(tax / 2)} /></>}
          <div className="flex justify-between pt-1 font-display text-3xl font-bold"><span>Total</span><span>{inr(total)}</span></div>
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button onClick={create} disabled={busy || !lines.length} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white active:scale-95 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create bill & print'}
        </button>
        <p className="text-xs text-slate-500">Parts added from search reduce stock when the bill is created. A bill cannot be edited afterwards.</p>
      </aside>
    </div>
  );
}

const R = ({ l, r }: { l: string; r: string }) => <div className="flex justify-between"><span className="text-slate-500">{l}</span><span>{r}</span></div>;

function History({ onOpen }: { onOpen: (inv: Invoice, items: InvoiceItem[]) => void }) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300).then(({ data, error }) => (error ? setErr(error.message) : setRows((data ?? []).map((r) => toInvoice(r)))));
  }, []);
  async function open(inv: Invoice) {
    const { data, error } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id).order('id');
    if (error) return setErr(error.message);
    onOpen(inv, (data ?? []).map((r) => toItem(r)));
  }
  const shown = rows.filter((r) => !q.trim() || [r.invoice_number, r.customer_name, r.vehicle_registration, r.customer_phone].join(' ').toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-3">
      <input className={inputCls + ' max-w-md'} placeholder="Search bill number, customer, vehicle…" value={q} onChange={(e) => setQ(e.target.value)} />
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>{['Bill', 'Date', 'Customer', 'Vehicle', 'GST', 'Total', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {shown.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No bills yet.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-mono">{r.invoice_number}</td>
                <td className="whitespace-nowrap px-4 py-2">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-2">{r.customer_name ?? 'Walk-in'}</td>
                <td className="px-4 py-2 font-mono">{r.vehicle_registration ?? '-'}</td>
                <td className="px-4 py-2">{r.gst_enabled ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 font-semibold">{inr(r.total)}</td>
                <td className="px-4 py-2"><button onClick={() => open(r)} className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">View / print</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
