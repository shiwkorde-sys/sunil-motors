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
            whileTap={{ scale: 0.98 }}
            aria-current={on ? 'page' : undefined}
            className={`relative shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full ${on ? 'text-[#7dd3fc]' : 'text-[#a8a399] hover:text-white'}`}
          >
            {on && (
              <m.span layoutId="nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-inset ring-white/10">
                <span className="absolute inset-x-3 bottom-0 h-[2px] rounded bg-[#0284c7] lg:inset-x-auto lg:bottom-2 lg:left-0 lg:top-2 lg:h-auto lg:w-[3px]" />
              </m.span>
            )}
            <span className="relative">{t}</span>
          </m.button>
        );
      })}
    </nav>
  );
}
