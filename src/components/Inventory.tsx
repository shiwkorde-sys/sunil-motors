import { useMemo, useState } from 'react';
import { downloadCsv } from '../lib/csv';
import { emptyQuery, searchParts, stockState, type Query } from '../lib/search';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import BulkUpload from './BulkUpload';
import PartDetail from './PartDetail';
import PartForm from './PartForm';
import SearchPanel from './SearchPanel';
import StockKpis, { type StockPick } from './StockKpis';
import { ErrorNote, Modal, StockBadge } from './ui';

type GroupBy = 'none' | 'category' | 'vehicle';
type Status = StockPick;
const NONE = 'Not set';
const sel = 'h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm';

export default function Inventory({ parts, reload }: { parts: Part[]; reload: () => void }) {
  const [query, setQuery] = useState<Query>(emptyQuery);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Part | 'new' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const opts = useMemo(() => {
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
    return { brands: uniq(parts.map((p) => p.company)), cats: uniq(parts.map((p) => p.category)), models: uniq(parts.flatMap((p) => p.compatible_models)) };
  }, [parts]);

  // `scoped` = everything the search and filters leave, ignoring the stock choice, so the four numbers stay meaningful when one is picked.
  const scoped = useMemo(
    () => searchParts(parts, query).filter((p) => (!brand || p.company === brand) && (!category || p.category === category) && (!model || p.compatible_models.includes(model))),
    [parts, query, brand, category, model],
  );
  const rows = useMemo(
    () => scoped.filter((p) => status === 'all' || (status === 'in' ? p.quantity_available > 0 : stockState(p) === status)),
    [scoped, status],
  );

  // Group by part type or by vehicle. A part that fits several bikes appears under each of them.
  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    const m = new Map<string, Part[]>();
    rows.forEach((p) => {
      const keys = groupBy === 'category' ? [p.category || NONE] : p.compatible_models.length ? p.compatible_models : [NONE];
      keys.forEach((k) => m.set(k, [...(m.get(k) ?? []), p]));
    });
    return [...m.entries()].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)));
  }, [rows, groupBy]);

  const filtered = Boolean(brand || category || model || status !== 'all' || query.vehicle || query.part || query.any);
  const clear = () => {
    setBrand('');
    setCategory('');
    setModel('');
    setStatus('all');
    setQuery(emptyQuery);
  };
  const toggle = (k: string) => setClosed((s) => (s.has(k) ? new Set([...s].filter((x) => x !== k)) : new Set(s).add(k)));
  const viewPart = parts.find((p) => p.id === viewing);

  async function remove(p: Part) {
    if (!confirm(`Delete "${p.name}"? Parts with sales history cannot be deleted. Set the quantity to 0 instead.`)) return;
    const { error } = await supabase.from('parts').delete().eq('id', p.id);
    if (error) setErr(error.code === '23503' ? 'This part has sales history, so it cannot be deleted. Set its quantity to 0 instead.' : error.message);
    else reload();
  }

  const row = (p: Part) => (
    <tr key={p.id} className="hover:bg-slate-50">
      <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
      <td className="px-4 py-2">
        <button onClick={() => setViewing(p.id)} className="text-left font-semibold hover:underline">{p.name}</button>
        <div className="text-xs text-slate-400">{[p.company, p.category].filter(Boolean).join(' · ')}</div>
      </td>
      <td className="max-w-xs px-4 py-2">{p.compatible_models.join(', ')}</td>
      <td className="px-4 py-2">{p.shelf_location}</td>
      <td className="px-4 py-2"><StockBadge part={p} /></td>
      <td className="whitespace-nowrap px-4 py-2 text-right">
        <button onClick={() => setEditing(p)} className="mr-3 text-brand hover:underline">Edit</button>
        <button onClick={() => remove(p)} className="text-slate-400 hover:text-red-600">Delete</button>
      </td>
    </tr>
  );

  return (
    <>
      <StockKpis parts={scoped} compact active={status} onPick={setStatus} />

      <SearchPanel query={query} onChange={setQuery} parts={parts} />

      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <label className="text-xs text-slate-500">Brand<select className={sel + ' mt-0.5 block'} value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All brands</option>{opts.brands.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-xs text-slate-500">Part type<select className={sel + ' mt-0.5 block'} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All types</option>{opts.cats.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-xs text-slate-500">Vehicle<select className={sel + ' mt-0.5 block'} value={model} onChange={(e) => setModel(e.target.value)}><option value="">All vehicles</option>{opts.models.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="text-xs text-slate-500">Stock<select className={sel + ' mt-0.5 block'} value={status} onChange={(e) => setStatus(e.target.value as Status)}><option value="all">Any stock</option><option value="in">Has stock</option><option value="low">Low</option><option value="out">Out of stock</option></select></label>
        <label className="text-xs text-slate-500">Group by<select className={sel + ' mt-0.5 block font-semibold'} value={groupBy} onChange={(e) => { setGroupBy(e.target.value as GroupBy); setClosed(new Set()); }}><option value="none">No grouping</option><option value="category">Part type</option><option value="vehicle">Vehicle</option></select></label>
        {filtered && <button onClick={clear} className="h-11 px-3 text-sm font-semibold text-brand underline">Clear filters</button>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-slate-500" aria-live="polite">
          {rows.length === parts.length ? `${rows.length} parts` : `${rows.length} of ${parts.length} parts`}
          {groupBy === 'vehicle' && <span className="ml-2 text-slate-400">A part that fits several vehicles is listed under each.</span>}
        </span>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv('inventory.csv', rows.map(({ id, compatible_models, ...r }) => ({ ...r, compatible_models: compatible_models.join('; ') })))} className="h-11 rounded-xl bg-white px-4 font-semibold shadow-sm active:scale-95">Download</button>
          <button onClick={() => setUploading(true)} className="h-11 rounded-xl bg-slate-900 px-4 font-semibold text-white active:scale-95">Bulk upload</button>
          <button onClick={() => setEditing('new')} className="h-11 rounded-xl bg-brand px-4 font-semibold text-white active:scale-95">+ Add part</button>
        </div>
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{['SKU', 'Part', 'Compatible models', 'Shelf', 'Stock', ''].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500"><div className="font-semibold text-slate-700">No parts match</div><div className="text-sm">Clear a filter or change the search.</div></td></tr>}
            {groups
              ? groups.map(([name, list]) => {
                  const open = !closed.has(name);
                  const units = list.reduce((n, p) => n + p.quantity_available, 0);
                  const need = list.filter((p) => stockState(p) !== 'ok').length;
                  return [
                    <tr key={'g-' + name} className="bg-slate-50">
                      <td colSpan={6} className="p-0">
                        <button onClick={() => toggle(name)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                          <span className={`inline-block text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
                          <span className="font-bold">{name}</span>
                          <span className="text-xs text-slate-500">{list.length} {list.length === 1 ? "part" : "parts"} · {units} {units === 1 ? "unit" : "units"}</span>
                          {need > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{need} low or out</span>}
                        </button>
                      </td>
                    </tr>,
                    ...(open ? list.map(row) : []),
                  ];
                })
              : rows.map(row)}
          </tbody>
        </table>
      </div>

      {editing && <PartForm part={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      {uploading && (
        <Modal title="Bulk upload parts" onClose={() => setUploading(false)}>
          <BulkUpload reload={reload} />
        </Modal>
      )}
      {viewPart && (
        <Modal title="Part details" onClose={() => setViewing(null)}>
          <PartDetail part={viewPart} onCheckedOut={() => { reload(); setViewing(null); }} onOpenPart={setViewing} />
        </Modal>
      )}
    </>
  );
}
