import { useState, type ReactNode } from 'react';
import type { Part } from '../lib/types';
import { stockState } from '../lib/search';
import { isConfigured } from '../lib/supabase';
import { GearIcon } from './icons';

/** Part photo that never breaks: a tidy placeholder shows if the link is missing or dead. */
export function PartImage({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-200 text-slate-400 ${className}`} role="img" aria-label="No photo available">
        <GearIcon className="h-1/3 w-1/3" />
      </div>
    );
  }
  // no-referrer: many parts websites block photos when another site (like ours) asks for them. Sending no "referrer" avoids that.
  return <img key={src} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
}

/** Soft status tints: red = out, amber = low, green = healthy. */
export function StockBadge({ part, big = false }: { part: Part; big?: boolean }) {
  const s = stockState(part);
  const tone =
    s === 'out' ? { bg: '#FDECEA', fg: '#B3261E', dot: '#FF453A' } : s === 'low' ? { bg: '#FFF3DC', fg: '#8A5300', dot: '#FF9F0A' } : { bg: '#E6F6EA', fg: '#1B6E35', dot: '#30D158' };
  const label = s === 'out' ? 'Out of stock' : s === 'low' ? `Low: ${part.quantity_available} left` : `${part.quantity_available} in stock`;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${big ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs'}`} style={{ background: tone.bg, color: tone.fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.dot }} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-2xl text-slate-500 hover:bg-slate-100" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export function ConfigWarning() {
  if (isConfigured) return null;
  return (
    <div className="m-4 rounded-xl bg-amber-100 p-4 text-sm text-amber-900">
      <b>Setup needed:</b> copy <code>.env.example</code> to <code>.env</code> and paste your Supabase URL and anon key, then restart.
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{children}</p>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} aria-hidden="true" />;
}
