import { useState } from 'react';
import { m } from 'framer-motion';
import type { Part } from '../lib/types';
import { StockBadge } from './ui';
import { ChevronRight, CopyIcon } from './icons';

/** One scannable row per part that needs reordering: name, bike tags, SKU, status, and a quick "copy reorder note" on hover. */
export default function RestockList({ parts, onOpen }: { parts: Part[]; onOpen: (p: Part) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(e: React.MouseEvent, p: Part) {
    e.stopPropagation();
    const fits = p.compatible_models.length ? ` Fits: ${p.compatible_models.join(', ')}.` : '';
    const note = `Reorder: ${p.name} (${p.sku}). ${p.quantity_available} left, minimum ${p.min_stock}.${fits}`;
    try {
      await navigator.clipboard.writeText(note);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1800);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  if (parts.length === 0) return <p className="py-6 text-center text-sm text-[#6e6e73]">Shelves look good. Nothing to reorder today.</p>;

  return (
    <ul className="-mx-2">
      {parts.map((p, i) => (
        <m.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.03, duration: 0.35 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(p)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(p))}
            title="Open in Inventory"
            className="group flex cursor-pointer items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors duration-150 hover:bg-[#f5f5f7] focus-visible:bg-[#f5f5f7] active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[#1d1d1f]">{p.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[11px] text-[#86868b]">{p.sku}</span>
                {p.compatible_models.slice(0, 2).map((mod) => (
                  <span key={mod} className="whitespace-nowrap rounded-md bg-[#f0f0f3] px-1.5 py-0.5 text-[11px] font-medium text-[#515154]">
                    {mod}
                  </span>
                ))}
                {p.compatible_models.length > 2 && <span className="text-[11px] text-[#86868b]">+{p.compatible_models.length - 2}</span>}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => copy(e, p)}
              className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#dcdce1] bg-white px-2.5 text-xs font-semibold text-[#515154] opacity-0 transition hover:border-[#0071e3] hover:text-[#0071e3] focus-visible:opacity-100 group-hover:opacity-100 active:scale-95"
            >
              <CopyIcon className="h-3.5 w-3.5" />
              {copied === p.id ? 'Copied' : 'Copy reorder note'}
            </button>
            <StockBadge part={p} />
            <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#0071e3]" />
          </div>
        </m.li>
      ))}
    </ul>
  );
}
