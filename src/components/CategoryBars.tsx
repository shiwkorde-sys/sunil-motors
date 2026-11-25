import { m } from 'framer-motion';

/** Units per category as segmented, gradient bars. Hover a bar for exact units and its share of all stock. */
export default function CategoryBars({ data }: { data: [string, number][] }) {
  const total = data.reduce((s, [, n]) => s + n, 0) || 1;
  const max = Math.max(1, ...data.map(([, n]) => n));

  return (
    <ul className="space-y-3.5">
      {data.map(([name, n], i) => {
        const share = (n / total) * 100;
        const width = (n / max) * 100;
        return (
          <li key={name} className="group relative">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-[#2b2925]">{name}</span>
              <span className="whitespace-nowrap">
                <b className="num text-[#1f1d1a]">{n.toLocaleString('en-IN')}</b>
                <span className="num ml-2 text-xs text-[#8a8579]">{share < 1 ? '<1' : Math.round(share)}%</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-[#eeebe3]">
              <m.div
                className="relative h-full overflow-hidden rounded-full"
                style={{ background: 'linear-gradient(90deg, #0369a1, #38bdf8)' }}
                initial={{ width: 0 }}
                whileInView={{ width: `${width}%` }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* thin vertical gaps make the bar look built from segments */}
                <span className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 14px, rgba(255,255,255,0.55) 14px 16px)' }} aria-hidden="true" />
              </m.div>
            </div>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-lg bg-[#141517] px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100"
              style={{ left: `min(${width}%, calc(100% - 190px))` }}
            >
              <b className="num">{n.toLocaleString('en-IN')}</b> units · <b className="num">{share.toFixed(1)}%</b> of all inventory
            </div>
          </li>
        );
      })}
    </ul>
  );
}
