import { useEffect, useRef, useState } from 'react';

export interface DateRange {
  from: string | null; // yyyy-mm-dd (local India day); null both = all time
  to: string | null;
}

const ymd = (d: Date) => d.toLocaleDateString('en-CA');
const parse = (s: string) => new Date(s + 'T00:00:00');
const addDays = (s: string, n: number) => ymd(new Date(parse(s).getTime() + n * 86400000));
const fmt = (s: string, year = false) => parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function rangeLabel(r: DateRange): string {
  const today = ymd(new Date());
  if (!r.from || !r.to) return 'All time';
  if (r.from === r.to) return r.from === today ? 'Today' : r.from === addDays(today, -1) ? 'Yesterday' : fmt(r.from, true);
  return `${fmt(r.from, parse(r.from).getFullYear() !== parse(r.to).getFullYear())} – ${fmt(r.to, true)}`;
}

/** One field, one popup: pick a ready-made period in one click, or tap two days on the calendar for any range. */
export default function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const today = ymd(new Date());
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parse(value.to ?? today));
  const [anchor, setAnchor] = useState<string | null>(null); // first tap of a custom range
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const choose = (r: DateRange) => {
    onChange(r);
    setAnchor(null);
    setOpen(false);
  };
  const d = parse(today);
  const presets: [string, DateRange][] = [
    ['Today', { from: today, to: today }],
    ['Yesterday', { from: addDays(today, -1), to: addDays(today, -1) }],
    ['Last 7 days', { from: addDays(today, -6), to: today }],
    ['Last 30 days', { from: addDays(today, -29), to: today }],
    ['This month', { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: today }],
    ['Last month', { from: ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: ymd(new Date(d.getFullYear(), d.getMonth(), 0)) }],
    ['All time', { from: null, to: null }],
  ];

  const tap = (day: string) => {
    if (!anchor) return setAnchor(day);
    const [a, b] = day < anchor ? [day, anchor] : [anchor, day];
    choose({ from: a, to: b });
  };
  const lo = anchor ? (hover && hover < anchor ? hover : anchor) : value.from;
  const hi = anchor ? (hover && hover > anchor ? hover : anchor) : value.to;

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => ymd(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  const atNow = month.getFullYear() === d.getFullYear() && month.getMonth() === d.getMonth();

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-semibold">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        {rangeLabel(value)}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true"><path d="M5.5 7.5 10 12l4.5-4.5-1.1-1.1L10 9.8 6.6 6.4z" /></svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose dates" className="anim-scale absolute left-0 z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:flex-row">
          <div className="flex flex-wrap gap-1.5 sm:w-36 sm:flex-col sm:gap-1">
            {presets.map(([label, r]) => {
              const on = r.from === value.from && r.to === value.to;
              return (
                <button key={label} onClick={() => choose(r)} className={`h-10 rounded-lg px-3 text-left text-sm font-medium ${on ? 'bg-brand text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="w-72">
            <div className="mb-1 flex items-center justify-between">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" className="h-10 w-10 rounded-lg text-xl hover:bg-slate-100">‹</button>
              <div className="font-semibold">{MONTHS[month.getMonth()]} {month.getFullYear()}</div>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} disabled={atNow} aria-label="Next month" className="h-10 w-10 rounded-lg text-xl hover:bg-slate-100 disabled:opacity-30">›</button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-slate-400">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <div key={i} className="py-1">{x}</div>)}</div>
            <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
              {cells.map((c, i) => {
                if (!c) return <div key={i} />;
                const future = c > today;
                const inRange = lo && hi && c >= lo && c <= hi;
                const edge = c === lo || c === hi;
                return (
                  <button
                    key={c}
                    disabled={future}
                    onClick={() => tap(c)}
                    onMouseEnter={() => anchor && setHover(c)}
                    aria-label={fmt(c, true)}
                    className={`h-10 text-sm ${edge ? 'rounded-lg bg-brand font-bold text-white' : inRange ? 'bg-sky-100' : 'rounded-lg hover:bg-slate-100'} ${c === today && !edge ? 'font-bold text-brand' : ''} disabled:text-slate-300`}
                  >
                    {Number(c.slice(8))}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 px-1 text-xs text-slate-500">{anchor ? `Start: ${fmt(anchor)}. Now tap the last day.` : 'Tap a first day, then a last day. Tap the same day twice for one day.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
