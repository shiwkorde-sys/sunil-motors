import { m } from 'framer-motion';
import type { Part } from '../lib/types';
import { stockState } from '../lib/search';
import { CountUp } from './motion';
import { BanIcon, BoxIcon, HourglassIcon, LayersIcon } from './icons';

export type StockPick = 'all' | 'in' | 'low' | 'out';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The four stock numbers (Overview shows them for everything; Inventory for whatever the filters leave).
 * If `onPick` is given, the tiles are buttons: tap one to filter the table to it (tap again to clear).
 * The small line under each number is worked out from the parts themselves; nothing here is invented.
 */
export default function StockKpis({ parts, compact = false, active, onPick, delay = 0 }: { parts: Part[]; compact?: boolean; active?: StockPick; onPick?: (s: StockPick) => void; delay?: number }) {
  const units = parts.reduce((s, p) => s + p.quantity_available, 0);
  const low = parts.filter((p) => stockState(p) === 'low').length;
  const out = parts.filter((p) => stockState(p) === 'out').length;
  const brands = new Set(parts.map((p) => p.company).filter(Boolean)).size;
  const cats = new Set(parts.map((p) => p.category).filter(Boolean)).size;
  const pct = (n: number) => (parts.length ? Math.round((n / parts.length) * 100) : 0);

  const items = [
    { label: 'All parts', value: parts.length, pick: 'all' as StockPick, icon: BoxIcon, accent: '#57534e', badge: '#ece9e1', hint: `${brands} brand${brands === 1 ? '' : 's'} · ${cats} categor${cats === 1 ? 'y' : 'ies'}` },
    { label: 'Units in stock', value: units, pick: 'in' as StockPick, icon: LayersIcon, accent: '#2f8061', badge: '#dfece5', hint: parts.length ? `about ${Math.round(units / parts.length).toLocaleString('en-IN')} per part` : 'no parts yet' },
    { label: 'Low stock', value: low, pick: 'low' as StockPick, icon: HourglassIcon, accent: '#c58a12', badge: '#f7ebc9', hint: low ? `${pct(low)}% of parts · reorder soon` : 'nothing running low' },
    { label: 'Out of stock', value: out, pick: 'out' as StockPick, icon: BanIcon, accent: '#c4573a', badge: '#f6e3dc', hint: out ? `${pct(out)}% of parts · reorder now` : 'everything is stocked' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Stock numbers">
      {items.map((k, i) => {
        const on = onPick ? (active ?? 'all') === k.pick : false;
        const Icon = k.icon;
        const cls = `group relative overflow-hidden rounded-[14px] border bg-white text-left ${compact ? 'px-4 pb-3 pt-4' : 'px-5 pb-4 pt-5'} ${on ? 'border-[#0284c7]' : 'border-[#e6e4dd] hover:border-[#cfcbbf]'} transition-colors`;
        const body = (
          <>
            {/* thin coloured line along the top edge */}
            <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: k.accent, opacity: on ? 1 : 0.75 }} aria-hidden="true" />
            <div className="flex items-start justify-between gap-2">
              <span className={`font-semibold text-[#6b675d] ${compact ? 'text-xs' : 'text-[13px]'}`}>{k.label}</span>
              <span className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'h-6 w-6' : 'h-8 w-8'}`} style={{ background: k.badge, color: k.accent }}>
                <Icon className={compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
              </span>
            </div>
            <div className={`num font-semibold leading-none text-[#1f1d1a] ${compact ? 'mt-2 text-3xl' : 'mt-4 text-[2.5rem]'}`}>
              <CountUp value={k.value} format={(n) => String(n)} />
            </div>
            <div className={`text-[#8a8579] ${compact ? 'mt-1.5 text-[11px]' : 'mt-2.5 text-xs'}`}>{k.hint}</div>
          </>
        );
        const motionProps = {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: delay + i * 0.05, duration: 0.45, ease: EASE },
          whileHover: { y: -2 },
          whileTap: onPick ? { scale: 0.98 } : undefined,
        };
        return onPick ? (
          <m.button
            key={k.label}
            type="button"
            onClick={() => onPick(on && k.pick !== 'all' ? 'all' : k.pick)}
            aria-pressed={on}
            title={on && k.pick !== 'all' ? 'Tap again to show everything' : `Show: ${k.label}`}
            className={cls}
            {...motionProps}
          >
            {body}
          </m.button>
        ) : (
          <m.div key={k.label} className={cls} {...motionProps}>
            {body}
          </m.div>
        );
      })}
    </div>
  );
}
