import { useMemo, useRef, useState } from 'react';
import { useLang } from '../lib/lang';
import { emptyQuery, type Query } from '../lib/search';
import { useVoiceSearch } from '../lib/speech';
import { photoToBase64 } from '../lib/image';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { CameraIcon, MicIcon } from './icons';
import Combobox from './Combobox';
import { EqBars, Spinner } from './motion';
import { searchParts } from '../lib/search';

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

  // Dropdown lists come from the shop's own stock. Part choices narrow to the chosen vehicle.
  const vehicleOptions = useMemo(() => {
    const set = new Set<string>();
    parts.forEach((p) => {
      if (p.company) set.add(p.company);
      p.compatible_models.forEach((m) => set.add(m));
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [parts]);
  const partOptions = useMemo(() => {
    const pool = query.vehicle.trim() ? searchParts(parts, { vehicle: query.vehicle, part: '', any: '' }) : parts;
    const set = new Set<string>();
    pool.forEach((p) => {
      if (p.category) set.add(p.category);
      set.add(p.name.replace(/\s*\(.*?\)\s*/g, ' ').trim());
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [parts, query.vehicle]);

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
    <button onClick={() => fileRef.current?.click()} disabled={camBusy} className={`${btn} ${size} !text-brand border-2 border-brand bg-white !shadow-none`} aria-label="Search by camera">
      {camBusy ? <Spinner className="h-6 w-6" /> : <CameraIcon className={icon} />}
      {camBusy ? 'Looking…' : 'Camera'}
    </button>
  );
  const mic = (
    <button
      onClick={voice.listening ? voice.stop : voice.start}
      className={`${btn} ${size} relative ${voice.listening ? 'bg-green-600' : 'bg-brand'}`}
      aria-label="Search by voice"
    >
      {voice.listening && <span className="ripple-ring pointer-events-none absolute inset-0 rounded-2xl bg-green-500" aria-hidden="true" />}
      {voice.listening ? <EqBars className="relative h-7" /> : <MicIcon className={icon} />}
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
          <div className="mx-auto grid max-w-lg grid-cols-[1.7fr_1fr] gap-3">
            {mic}
            {camera}
          </div>
        </div>
      ) : null}

      <div className={large ? 'space-y-2' : 'grid grid-cols-[auto_auto_1fr_1fr] items-center gap-3'}>
        {!large && camera}
        {!large && mic}
        <Combobox
          label="Vehicle name"
          large={large}
          value={query.vehicle}
          onChange={(v) => onChange({ ...query, vehicle: v, any: '' })}
          options={vehicleOptions}
          placeholder="Vehicle: pick or type (Activa, Splendor…)"
        />
        <Combobox
          label="Part name"
          large={large}
          value={query.part}
          onChange={(v) => onChange({ ...query, part: v, any: '' })}
          options={partOptions}
          placeholder="Part: pick or type (Brake, Clutch…)"
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
