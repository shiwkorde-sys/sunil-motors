import { m } from 'framer-motion';

/** Sidebar links. One highlight pill slides between them (shared layout animation). */
export default function AdminNav<T extends string>({ tabs, tab, onPick }: { tabs: readonly T[]; tab: T; onPick: (t: T) => void }) {
  return (
    <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1" aria-label="Sections">
      {tabs.map((t) => {
        const on = t === tab;
        return (
          <m.button
            key={t}
            onClick={() => onPick(t)}
            whileTap={{ scale: 0.97 }} whileHover={{ x: on ? 0 : 2 }}
            aria-current={on ? 'page' : undefined}
            className={`relative shrink-0 whitespace-nowrap rounded-[10px] px-3 py-2 text-left text-[14px] font-medium transition-colors lg:w-full ${on ? 'text-[#0071e3]' : 'text-[#515154] hover:text-[#1d1d1f]'}`}
          >
            {on && (
              <m.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-[10px] bg-[#0071e3]/10" />
            )}
            <span className="relative">{t}</span>
          </m.button>
        );
      })}
    </nav>
  );
}
