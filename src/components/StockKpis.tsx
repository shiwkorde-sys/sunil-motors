import type { Part } from '../lib/types';
import { stockState } from '../lib/search';
import { CountUp, stagger } from './motion';

/** The four stock numbers (Overview shows them for everything; Inventory for whatever the filters leave). */
export default function StockKpis({ parts, compact = false }: { parts: Part[]; compact?: boolean }) {
  const units = parts.reduce((s, p) => s + p.quantity_available, 0);
  const low = parts.filter((p) => stockState(p) === 'low').length;
  const out = parts.filter((p) => stockState(p) === 'out').length;
  const items = [
    { label: 'Unique parts (SKUs)', value: parts.length, tone: '' },
    { label: 'Units in stock', value: units, tone: '' },
    { label: 'Low stock', value: low, tone: low ? 'text-amber-600' : '' },
    { label: 'Out of stock', value: out, tone: out ? 'text-red-600' : '' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Stock numbers">
      {items.map((k, i) => (
        <div key={k.label} className={`anim-up rounded-2xl bg-white shadow-sm ${compact ? 'px-4 py-3' : 'p-5'}`} style={stagger(i)}>
          <div className={compact ? 'text-xs font-medium text-slate-500' : 'text-sm text-slate-500'}>{k.label}</div>
          <div className={`font-display font-bold leading-tight ${compact ? 'text-3xl' : 'text-5xl'} ${k.tone}`}>
            <CountUp value={k.value} />
          </div>
        </div>
      ))}
    </div>
  );
}
