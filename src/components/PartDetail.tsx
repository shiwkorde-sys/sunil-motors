import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLang, useLang } from '../lib/lang';
import { speak, stockSentence } from '../lib/speech';
import type { Part } from '../lib/types';
import CheckoutSheet from './CheckoutSheet';
import { ChevronRight, PinIcon, SpeakerIcon } from './icons';
import { PartImage, StockBadge } from './ui';

interface Props {
  part: Part;
  onCheckedOut: (msg: string) => void;
  onOpenPart: (id: string) => void;
  /** Mobile: Read aloud + Checkout stay pinned at the bottom of the screen, in thumb reach. */
  sticky?: boolean;
  /** Mobile: speak the stock details as soon as the part opens (the button replays it). */
  autoRead?: boolean;
}

export default function PartDetail({ part, onCheckedOut, onOpenPart, sticky = false, autoRead = false }: Props) {
  const [checkout, setCheckout] = useState(false);
  const [alts, setAlts] = useState<Part[]>([]);
  const [altsLoading, setAltsLoading] = useState(false);
  const [altsError, setAltsError] = useState(false);
  const [ttsMsg, setTtsMsg] = useState<string | null>(null);
  const lang = useLang();
  const out = part.quantity_available === 0;

  // Out of stock → ask the database for in-stock parts that fit the same bike models.
  useEffect(() => {
    setAlts([]);
    setAltsError(false);
    setTtsMsg(null);
    if (!out) return;
    setAltsLoading(true);
    supabase.rpc('find_alternatives', { p_part_id: part.id }).then(({ data, error }) => {
      if (error) setAltsError(true);
      else setAlts((data as Part[]) ?? []);
      setAltsLoading(false);
    });
  }, [part.id, out]);

  function readOut() {
    const l = getLang();
    const r = speak(stockSentence(part, l), l);
    setTtsMsg(
      !r.supported
        ? 'Audio readout is not supported on this browser.'
        : r.noVoice && l === 'hi'
          ? 'इस फ़ोन में हिन्दी आवाज़ नहीं मिली, इसलिए आवाज़ अलग हो सकती है।'
          : null,
    );
  }

  // Read the part aloud as soon as it opens; stop talking when the mechanic leaves the page.
  useEffect(() => {
    if (!autoRead) return;
    readOut();
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* audio not supported */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.id, autoRead]);

  const actions = (
    <div className="mx-auto max-w-lg">
      <button
        onClick={() => setCheckout(true)}
        disabled={out}
        className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white active:scale-95 disabled:bg-slate-300 disabled:text-slate-500"
      >
        {out ? 'Out of stock' : 'Checkout part'}
      </button>
    </div>
  );

  return (
    <div className={`space-y-4 ${sticky ? 'pb-36' : ''}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-display text-3xl font-bold uppercase leading-tight">{part.name}</h1>
          <button
            onClick={readOut}
            aria-label={lang === 'hi' ? 'सुनें' : 'Read aloud'}
            title={lang === 'hi' ? 'सुनें' : 'Read aloud'}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white active:scale-95"
          >
            <SpeakerIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="text-sm text-slate-500">{[part.company, part.category].filter(Boolean).join(' · ')}</p>
        <div className="mt-2">
          <StockBadge part={part} big />
        </div>
      </div>

      <section className="rounded-2xl bg-slate-900 p-4 text-white" aria-label="Where to find it">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Find it on the shelf</div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-display text-4xl font-bold leading-none tracking-wide">
            <PinIcon className="h-7 w-7 shrink-0 text-slate-300" />
            <span className="break-words">{part.shelf_location || 'Not set'}</span>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-5xl font-bold leading-none">{part.quantity_available}</div>
            <div className="text-xs text-slate-300">in stock</div>
          </div>
        </div>
      </section>

      {part.image_url && <PartImage src={part.image_url} alt={part.name} className="h-44 w-full rounded-2xl" />}

      <div className="grid grid-cols-2 gap-3">
        <Info label="SKU" value={part.sku} mono />
        <Info label="Size" value={part.dimension} />
      </div>

      {part.description && <p className="text-slate-700">{part.description}</p>}

      <div>
        <h2 className="mb-1.5 text-sm font-semibold text-slate-600">Compatible models</h2>
        <div className="flex flex-wrap gap-2">
          {part.compatible_models.length ? (
            part.compatible_models.map((m) => (
              <span key={m} className="rounded-full bg-slate-200 px-3 py-1.5 text-sm">
                {m}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">Not listed</span>
          )}
        </div>
      </div>

      {ttsMsg && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{ttsMsg}</p>}

      {out && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" aria-live="polite">
          <h2 className="font-display text-xl font-bold uppercase text-amber-900">Out of stock: try these</h2>
          <p className="mb-3 text-sm text-amber-800">In-stock parts of the same type that fit the same bike model.</p>
          {altsLoading && <div className="h-16 animate-pulse rounded-xl bg-amber-100" />}
          {altsError && <p className="text-sm text-red-700">Could not load alternatives. Check your connection.</p>}
          {!altsLoading && !altsError && alts.length === 0 && <p className="text-sm text-slate-700">No compatible in-stock alternative found. Ask the owner to reorder.</p>}
          <ul className="space-y-2">
            {alts.map((a) => (
              <li key={a.id}>
                <button onClick={() => onOpenPart(a.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm active:bg-slate-50">
                  <PartImage src={a.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      Fits {a.compatible_models.join(', ')} · Shelf {a.shelf_location ?? '-'}
                    </span>
                    <span className="mt-1 block">
                      <StockBadge part={a} />
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sticky ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-white px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-3">{actions}</div>
      ) : (
        actions
      )}

      {checkout && <CheckoutSheet part={part} onClose={() => setCheckout(false)} onDone={onCheckedOut} />}
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`break-words font-semibold ${mono ? 'font-mono text-sm' : ''}`}>{value || '-'}</div>
    </div>
  );
}
