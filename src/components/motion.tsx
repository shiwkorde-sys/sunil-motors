import { useEffect, useRef, useState } from 'react';

/** Number that counts up to its value when it appears. */
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value <= 0) return setN(value);
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms]);
  return <>{n}</>;
}

/** Stagger helper: style for the i-th item in a list (capped so long lists don't wait). */
export const stagger = (i: number) => ({ animationDelay: `${Math.min(i, 8) * 45}ms` });

/** Animated tick drawn inside a circle. */
export function CheckBadge({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`anim-pop inline-flex shrink-0 items-center justify-center rounded-full bg-green-600 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}

/** Sound-wave bars shown while the microphone is listening. */
export function EqBars({ className = 'h-7' }: { className?: string }) {
  return (
    <span className={`flex items-end gap-1 ${className}`} aria-hidden="true">
      {[0, 0.15, 0.3, 0.1, 0.25].map((d, i) => (
        <span key={i} className="eq-bar w-1.5 rounded-full bg-white" style={{ height: '100%', animationDelay: `${d}s` }} />
      ))}
    </span>
  );
}

export const Spinner = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <span className={`spinner inline-block rounded-full border-[3px] border-current border-t-transparent ${className}`} aria-hidden="true" />
);
