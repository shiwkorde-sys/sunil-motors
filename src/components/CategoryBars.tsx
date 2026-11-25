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
              <span className="truncate font-medium text-[#1d1d1f]">{name}</span>
              <span className="whitespace-nowrap">
                <b className="num text-[#1d1d1f]">{n.toLocaleString('en-IN')}</b>
                <span className="num ml-2 text-xs text-[#86868b]">{share < 1 ? '<1' : Math.round(share)}%</span>
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-[#ececf0]">
              <m.div
                className="relative h-full rounded-full transition-[filter] duration-200 group-hover:brightness-110"
                style={{ background: 'linear-gradient(90deg, #0071e3, #5ac8fa)' }}
                initial={{ width: 0 }}
                whileInView={{ width: `${width}%` }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
              </m.div>
            </div>
            <div
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-0 z-10 whitespace-nowrap rounded-lg bg-[#1d1d1f]/90 backdrop-blur px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition duration-150 group-hover:-translate-y-0.5 group-hover:opacity-100"
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
