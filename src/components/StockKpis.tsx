import type { Part } from '../lib/types';
import { stockState } from '../lib/search';
import { CountUp, stagger } from './motion';

/** The four stock numbers (Overview shows them for everything; Inventory for whatever the filters leave). */
export type StockPick = 'all' | 'in' | 'low' | 'out';

/** If `onPick` is given, the cards are buttons: tap one to filter the table to it (tap again to clear). */
export default function StockKpis({ parts, compact = false, active, onPick }: { parts: Part[]; compact?: boolean; active?: StockPick; onPick?: (s: StockPick) => void }) {
  const units = parts.reduce((s, p) => s + p.quantity_available, 0);
  const low = parts.filter((p) => stockState(p) === 'low').length;
  const out = parts.filter((p) => stockState(p) === 'out').length;
  const items = [
    { label: 'Unique parts (SKUs)', value: parts.length, tone: '', pick: 'all' as StockPick },
    { label: 'Units in stock', value: units, tone: '', pick: 'in' as StockPick },
    { label: 'Low stock', value: low, tone: low ? 'text-amber-600' : '', pick: 'low' as StockPick },
    { label: 'Out of stock', value: out, tone: out ? 'text-red-600' : '', pick: 'out' as StockPick },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Stock numbers">
      {items.map((k, i) => {
        const body = (
          <>
            <div className={compact ? 'text-xs font-medium text-slate-500' : 'text-sm text-slate-500'}>{k.label}</div>
            <div className={`font-display font-bold leading-tight ${compact ? 'text-3xl' : 'text-5xl'} ${k.tone}`}>
              <CountUp value={k.value} />
            </div>
          </>
        );
        const base = `anim-up rounded-2xl bg-white shadow-sm ${compact ? 'px-4 py-3' : 'p-5'}`;
        if (!onPick) return <div key={k.label} className={base} style={stagger(i)}>{body}</div>;
        const on = (active ?? 'all') === k.pick;
        return (
          <button
            key={k.label}
            type="button"
            onClick={() => onPick(on && k.pick !== 'all' ? 'all' : k.pick)}
            aria-pressed={on}
            title={on && k.pick !== 'all' ? 'Tap again to show everything' : `Show: ${k.label}`}
            className={`${base} text-left transition active:scale-[0.98] ${on ? 'ring-2 ring-brand' : 'ring-1 ring-transparent hover:ring-slate-300'}`}
            style={stagger(i)}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
