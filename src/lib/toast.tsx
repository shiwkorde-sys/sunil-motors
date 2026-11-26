import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';

type Kind = 'success' | 'error' | 'info';
interface Action { label: string; run: () => void }
interface Toast { id: number; kind: Kind; text: string; action?: Action }

const Ctx = createContext<{ push: (kind: Kind, text: string, action?: Action) => void }>({ push: () => {} });

/** Small confirmations that appear, say what happened, and leave by themselves. Errors stay longer and can offer "Try again". */
export const useToast = () => {
  const { push } = useContext(Ctx);
  return useMemo(
    () => ({
      success: (text: string, action?: Action) => push('success', text, action),
      error: (text: string, action?: Action) => push('error', text, action),
      info: (text: string, action?: Action) => push('info', text, action),
    }),
    [push],
  );
};

function Mark({ kind }: { kind: Kind }) {
  const color = kind === 'success' ? '#30d158' : kind === 'error' ? '#ff453a' : '#64d2ff';
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" aria-hidden="true">
      <m.circle cx="12" cy="12" r="10" fill={color} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} />
      {kind === 'success' && <m.path d="m7.5 12.5 3 3 6-6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.12, duration: 0.3, ease: 'easeOut' }} />}
      {kind === 'error' && <m.path d="M12 7.5v5.5M12 16.4v.1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.12, duration: 0.25 }} />}
      {kind === 'info' && <m.path d="M12 11v5.5M12 7.6v.1" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.12, duration: 0.25 }} />}
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, text: string, action?: Action) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-2), { id, kind, text, action }]);
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : action ? 6500 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              layout
              role={t.kind === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } }}
              exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.14 } }}
              className="pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl bg-[#1d1d1f]/95 py-3 pl-3.5 pr-2 text-[14px] font-medium leading-snug text-white shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            >
              <Mark kind={t.kind} />
              <span className="min-w-0 flex-1">{t.text}</span>
              {t.action && (
                <button onClick={() => { t.action!.run(); dismiss(t.id); }} className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-semibold text-[#64d2ff] hover:bg-white/10">
                  {t.action.label}
                </button>
              )}
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="h-9 w-9 shrink-0 rounded-lg text-xl leading-none text-white/60 hover:bg-white/10 hover:text-white">
                ×
              </button>
              <span className="toast-bar absolute inset-x-0 bottom-0 h-[2px] origin-left bg-white/30" style={{ animationDuration: `${t.kind === 'error' ? 8000 : t.action ? 6500 : 4500}ms` }} aria-hidden="true" />
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
