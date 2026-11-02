import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getLang } from '../lib/lang';
import { speak, stockSentence } from '../lib/speech';
import type { Part } from '../lib/types';
import CheckoutSheet from './CheckoutSheet';
import { PartImage, StockBadge } from './ui';

interface Props {
  part: Part;
  onCheckedOut: (msg: string) => void;
  onOpenPart: (id: string) => void;
}

export default function PartDetail({ part, onCheckedOut, onOpenPart }: Props) {
  const [checkout, setCheckout] = useState(false);
  const [alts, setAlts] = useState<Part[]>([]);
  const [altsError, setAltsError] = useState(false);
  const [ttsMsg, setTtsMsg] = useState<string | null>(null);
  const out = part.quantity_available === 0;

  // Out of stock → ask the database for in-stock parts that fit the same bike models.
  useEffect(() => {
    setAlts([]);
    setAltsError(false);
    if (!out) return;
    supabase.rpc('find_alternatives', { p_part_id: part.id }).then(({ data, error }) => {
      if (error) setAltsError(true);
      else setAlts((data as Part[]) ?? []);
    });
  }, [part.id, out]);

  function readOut() {
    const lang = getLang();
    const r = speak(stockSentence(part, lang), lang);
    setTtsMsg(
      !r.supported
        ? 'Audio readout is not supported on this browser.'
        : r.noVoice && lang === 'hi'
          ? 'इस फ़ोन में हिन्दी आवाज़ नहीं मिली, इसलिए आवाज़ अलग हो सकती है।'
          : null,
    );
  }

  return (
    <div className="space-y-4">
      <PartImage src={part.image_url} alt={part.name} className="h-56 w-full rounded-2xl" />
      <div>
        <h1 className="text-2xl font-bold leading-tight">{part.name}</h1>
        <p className="text-sm text-slate-500">
          {[part.company, part.category].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-2">
          <StockBadge part={part} big />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Info label="Shelf / Rack" value={part.shelf_location} big />
        <Info label="Quantity available" value={String(part.quantity_available)} big />
        <Info label="SKU" value={part.sku} />
        <Info label="Size" value={part.dimension} />
      </div>

      {part.description && <p className="text-slate-700">{part.description}</p>}

      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-600">Compatible models</h3>
        <div className="flex flex-wrap gap-2">
          {part.compatible_models.length ? (
            part.compatible_models.map((m) => (
              <span key={m} className="rounded-full bg-slate-200 px-3 py-1 text-sm">
                {m}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">Not listed</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={readOut} className="h-14 rounded-xl bg-slate-800 font-bold text-white active:scale-95">
          🔊 सुनें · Read aloud
        </button>
        <button
          onClick={() => setCheckout(true)}
          disabled={out}
          className="h-14 rounded-xl bg-brand font-bold text-white active:scale-95 disabled:bg-slate-300"
        >
          Checkout part
        </button>
      </div>
      {ttsMsg && <p className="text-sm text-amber-700">{ttsMsg}</p>}

      {out && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-1 text-lg font-bold text-amber-900">Out of stock — in-stock alternatives</h3>
          <p className="mb-3 text-sm text-amber-800">Same type of part that fits the same bike models:</p>
          {altsError && <p className="text-sm text-red-700">Could not load alternatives. Check your connection.</p>}
          {!altsError && alts.length === 0 && <p className="text-sm text-slate-600">No compatible in-stock alternative found.</p>}
          <ul className="space-y-2">
            {alts.map((a) => (
              <li key={a.id}>
                <button onClick={() => onOpenPart(a.id)} className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm active:scale-[.99]">
                  <PartImage src={a.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      Fits: {a.compatible_models.join(', ')} · Shelf {a.shelf_location ?? '—'}
                    </span>
                  </span>
                  <StockBadge part={a} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {checkout && <CheckoutSheet part={part} onClose={() => setCheckout(false)} onDone={onCheckedOut} />}
    </div>
  );
}

function Info({ label, value, big = false }: { label: string; value: string | null; big?: boolean }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`break-words font-bold ${big ? 'text-2xl' : 'text-base'}`}>{value || '—'}</div>
    </div>
  );
}
