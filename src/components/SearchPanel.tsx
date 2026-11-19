import { useRef, useState } from 'react';
import { useLang } from '../lib/lang';
import { emptyQuery, type Query } from '../lib/search';
import { useVoiceSearch } from '../lib/speech';
import { photoToBase64 } from '../lib/image';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { CameraIcon, MicIcon } from './icons';
import { inputCls } from './ui';

interface Props {
  query: Query;
  onChange: (q: Query) => void;
  parts: Part[];
  /** Mobile: Camera + Voice are big buttons docked at the bottom of the screen, in thumb reach. */
  large?: boolean;
}

export default function SearchPanel({ query, onChange, parts, large = false }: Props) {
  const [camBusy, setCamBusy] = useState(false);
  const [camMsg, setCamMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = useLang();

  const voice = useVoiceSearch((text) => onChange({ vehicle: '', part: '', any: text }));

  async function onPhoto(file?: File) {
    if (!file) return;
    setCamBusy(true);
    setCamMsg(null);
    try {
      const image = await photoToBase64(file);
      const vocabulary = [...new Set(parts.map((p) => p.category).filter(Boolean))].join(', ');
      const { data, error } = await supabase.functions.invoke('identify-part', { body: { image, mediaType: 'image/jpeg', vocabulary } });
      if (error || data?.error) throw new Error(error?.message ?? data.error);
      const words: string[] = data.keywords?.length ? data.keywords : String(data.part_name ?? '').split(' ');
      if (!words.length || data.part_name === 'unknown') setCamMsg('Could not recognise a part in that photo. Try a closer, well-lit photo or search by name.');
      else {
        onChange({ vehicle: '', part: '', any: words.join(' ') });
        setCamMsg(`Looks like: ${data.part_name}`);
      }
    } catch {
      setCamMsg('Photo search is not available right now. Please search by name instead.');
    } finally {
      setCamBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const btn = 'flex items-center justify-center gap-2 rounded-2xl font-bold text-white shadow transition active:scale-95 disabled:opacity-60';
  const size = large ? 'h-16 text-lg' : 'h-12 px-5 text-base';
  const icon = large ? 'h-7 w-7' : 'h-5 w-5';

  const camera = (
    <button onClick={() => fileRef.current?.click()} disabled={camBusy} className={`${btn} ${size} bg-brand`} aria-label="Search by camera">
      <CameraIcon className={icon} />
      {camBusy ? 'Looking…' : 'Camera'}
    </button>
  );
  const mic = (
    <button
      onClick={voice.listening ? voice.stop : voice.start}
      className={`${btn} ${size} ${voice.listening ? 'animate-pulse bg-green-600' : 'bg-slate-800'}`}
      aria-label="Search by voice"
    >
      <MicIcon className={icon} />
      {voice.listening ? (lang === 'hi' ? 'बोलिए…' : 'Listening…') : lang === 'hi' ? 'बोलकर खोजें' : 'Voice'}
    </button>
  );

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />

      {large ? (
        // Docked at the bottom edge so thumbs reach it without stretching.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-slate-100 px-4 pb-[calc(3.75rem+env(safe-area-inset-bottom))] pt-3">
          {/* extra bottom space keeps the buttons clear of Netlify's floating badge */}
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
            {camera}
            {mic}
          </div>
        </div>
      ) : null}

      <div className={large ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-[auto_auto_1fr_1fr] items-center gap-3'}>
        {!large && camera}
        {!large && mic}
        <input
          className={inputCls + (large ? ' h-12 text-base' : '')}
          placeholder="Vehicle  e.g. Activa, Splendor"
          value={query.vehicle}
          onChange={(e) => onChange({ ...query, vehicle: e.target.value, any: '' })}
          aria-label="Vehicle name"
        />
        <input
          className={inputCls + (large ? ' h-12 text-base' : '')}
          placeholder="Part  e.g. Brake Shoe"
          value={query.part}
          onChange={(e) => onChange({ ...query, part: e.target.value, any: '' })}
          aria-label="Part name"
        />
      </div>

      {query.any && (
        <div className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-2 text-sm text-white">
          <span>
            Searching: <b>{query.any}</b>
          </span>
          <button onClick={() => onChange(emptyQuery)} className="font-semibold underline">
            Clear
          </button>
        </div>
      )}
      {voice.error && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{voice.error}</p>}
      {camMsg && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{camMsg}</p>}
    </div>
  );
}
