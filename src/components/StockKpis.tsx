import { LayoutGroup, m } from 'framer-motion';
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
    { label: 'All parts', value: parts.length, pick: 'all' as StockPick, icon: BoxIcon, accent: '#0071e3', badge: '#e8f1fd', hint: `${brands} brand${brands === 1 ? '' : 's'} · ${cats} categor${cats === 1 ? 'y' : 'ies'}` },
    { label: 'Units in stock', value: units, pick: 'in' as StockPick, icon: LayersIcon, accent: '#248a3d', badge: '#e6f6ea', hint: parts.length ? `about ${Math.round(units / parts.length).toLocaleString('en-IN')} per part` : 'no parts yet' },
    { label: 'Low stock', value: low, pick: 'low' as StockPick, icon: HourglassIcon, accent: '#c77700', badge: '#fff3dc', hint: low ? `${pct(low)}% of parts · reorder soon` : 'nothing running low' },
    { label: 'Out of stock', value: out, pick: 'out' as StockPick, icon: BanIcon, accent: '#d70015', badge: '#fdecea', hint: out ? `${pct(out)}% of parts · reorder now` : 'everything is stocked' },
  ];

  return (
    <LayoutGroup>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Stock numbers">
      {items.map((k, i) => {
        const on = onPick ? (active ?? 'all') === k.pick : false;
        const Icon = k.icon;
        const cls = `group relative overflow-hidden rounded-[20px] bg-white text-left ${compact ? 'px-4 py-3.5' : 'px-5 py-5'} shadow-[0_0_0_1px_rgba(0,0,0,0.045),0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.09)]`;
        const body = (
          <>
            {/* the blue selection ring glides from tile to tile */}
            {on && <m.span layoutId="kpi-ring" transition={{ type: 'spring', stiffness: 520, damping: 40 }} className="pointer-events-none absolute inset-0 rounded-[20px] ring-2 ring-inset ring-[#0071e3]" />}
            <div className="flex items-start justify-between gap-2">
              <span className={`font-medium text-[#6e6e73] ${compact ? 'text-xs' : 'text-[13px]'}`}>{k.label}</span>
              <span className={`flex shrink-0 items-center justify-center rounded-[9px] ${compact ? 'h-6 w-6' : 'h-8 w-8'}`} style={{ background: k.badge, color: k.accent }}>
                <Icon className={compact ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]'} />
              </span>
            </div>
            <div className={`num font-semibold leading-none text-[#1d1d1f] ${compact ? 'mt-2 text-3xl' : 'mt-4 text-[2.75rem]'}`}>
              <CountUp value={k.value} format={(n) => String(n)} />
            </div>
            <div className={`text-[#86868b] ${compact ? 'mt-1.5 text-[11px]' : 'mt-2.5 text-xs'}`}>{k.hint}</div>
          </>
        );
        const motionProps = {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: delay + i * 0.05, duration: 0.45, ease: EASE },
          whileHover: { y: -3 },
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
    </LayoutGroup>
  );
}
