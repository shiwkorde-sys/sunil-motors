import { useMemo } from 'react';
import { useLang } from '../lib/lang';
import { emptyQuery, type Query } from '../lib/search';
import { useVoiceSearch } from '../lib/speech';
import type { Part } from '../lib/types';
import { MicIcon } from './icons';
import Combobox from './Combobox';
import { EqBars } from './motion';
import { searchParts } from '../lib/search';

interface Props {
  query: Query;
  onChange: (q: Query) => void;
  parts: Part[];
  /** Mobile: the Voice button is big and docked at the bottom of the screen, in thumb reach. */
  large?: boolean;
}

export default function SearchPanel({ query, onChange, parts, large = false }: Props) {
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

  const btn = 'flex items-center justify-center gap-2 rounded-2xl font-bold text-white shadow transition active:scale-95 disabled:opacity-60';
  const size = large ? 'h-16 text-lg' : 'h-12 px-5 text-base';
  const icon = large ? 'h-7 w-7' : 'h-5 w-5';

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
      {large ? (
        // Docked at the bottom edge so thumbs reach it without stretching.
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-slate-100 px-4 pb-[calc(3.75rem+env(safe-area-inset-bottom))] pt-3">
          {/* extra bottom space keeps the buttons clear of Netlify's floating badge */}
          <div className="mx-auto max-w-lg [&>button]:w-full">
            {mic}
          </div>
        </div>
      ) : null}

      <div className={large ? 'space-y-2' : 'grid grid-cols-[auto_1fr_1fr] items-center gap-3'}>
        {!large && mic}
        <Combobox
          label="Vehicle name"
          large={large}
          value={query.vehicle}
          onChange={(v) => onChange({ ...query, vehicle: v, any: '' })}
          options={vehicleOptions}
          placeholder="Which bike? Activa, Splendor…"
        />
        <Combobox
          label="Part name"
          large={large}
          value={query.part}
          onChange={(v) => onChange({ ...query, part: v, any: '' })}
          options={partOptions}
          placeholder="Which part? Brake, Clutch…"
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
    </div>
  );
}
