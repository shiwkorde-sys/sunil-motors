import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { setLang, useLang } from '../lib/lang';
import { emptyQuery, isSearching, searchParts, type Query } from '../lib/search';
import { useParts } from '../lib/useParts';
import PartDetail from '../components/PartDetail';
import SearchPanel from '../components/SearchPanel';
import { ArrowLeft, ChevronRight, PinIcon } from '../components/icons';
import { ConfigWarning, ErrorNote, PartImage, StockBadge } from '../components/ui';

const BRANDS = ['Honda', 'Hero', 'Bajaj', 'TVS', 'Royal Enfield', 'Suzuki', 'Ather'];
const TYPES = ['Brake', 'Clutch', 'Belt', 'Filter', 'Shock', 'Switch', 'Cable', 'Sensor'];
const EXAMPLES = ['Splendor clutch plate', 'Activa belt', 'Pulsar rear brake'];
const EXAMPLES_HI = ['स्प्लेंडर क्लच प्लेट', 'एक्टिवा बेल्ट', 'पल्सर रियर ब्रेक'];

function Header({ back }: { back?: boolean }) {
  const { isAdmin, signOut, profile } = useAuth();
  const lang = useLang();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-brand px-4 py-2.5 text-white">
      {back ? (
        <Link to="/m" className="flex h-11 items-center gap-1 pr-3 text-base font-bold">
          <ArrowLeft className="h-5 w-5" /> Back
        </Link>
      ) : (
        <span className="whitespace-nowrap font-display text-xl font-bold uppercase tracking-wide">Sunil Motors</span>
      )}
      <div className="flex items-center gap-1.5 text-sm">
        <div className="flex overflow-hidden rounded-lg bg-white/20" role="group" aria-label="Audio language">
          {(['hi', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`h-10 px-2.5 ${lang === l ? 'bg-white font-bold text-brand' : ''}`}>
              {l === 'hi' ? 'हिन्दी' : 'EN'}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link to="/dashboard" className="flex h-10 items-center px-1 underline">
            Admin
          </Link>
        )}
        <button onClick={signOut} className="h-10 whitespace-nowrap rounded-lg bg-white/20 px-2.5" title={profile?.email ?? ''}>
          Sign out
        </button>
      </div>
    </header>
  );
}

function ChipRow({ label, items, active, onPick }: { label: string; items: string[]; active: string; onPick: (v: string) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {items.map((i) => {
          const on = active.trim().toLowerCase() === i.toLowerCase();
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              aria-pressed={on}
              className={`h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${on ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              {i}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MobileHome() {
  const { parts, loading, error } = useParts();
  const { displayName } = useAuth();
  const lang = useLang();
  const [query, setQuery] = useState<Query>(emptyQuery);
  const nav = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<string | null>((location.state as { toast?: string } | null)?.toast ?? null);

  // Show the "checked out" message for a few seconds, then clear it (and the router state, so a refresh won't repeat it).
  useEffect(() => {
    if (!toast) return;
    nav('/m', { replace: true, state: null });
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast, nav]);

  const searching = isSearching(query);
  const results = useMemo(() => (searching ? searchParts(parts, query) : []), [parts, query, searching]);

  const pick = (field: 'vehicle' | 'part', v: string) =>
    setQuery((q) => ({ vehicle: field === 'vehicle' ? (q.vehicle.trim().toLowerCase() === v.toLowerCase() ? '' : v) : q.vehicle, part: field === 'part' ? (q.part.trim().toLowerCase() === v.toLowerCase() ? '' : v) : q.part, any: '' }));

  const examples = lang === 'hi' ? EXAMPLES_HI : EXAMPLES;

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-44">
      <Header />
      <ConfigWarning />
      <main className="space-y-4 p-4">
        {toast && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-green-100 p-3 font-semibold text-green-900">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="-mr-1 -mt-1 h-9 w-9 shrink-0 text-2xl leading-none" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <h1 className="font-display text-3xl font-bold uppercase leading-none">
          {lang === 'hi' ? 'नमस्ते' : 'Hi'}
          {displayName ? `, ${displayName.split(' ')[0]}` : ''}
        </h1>

        <SearchPanel query={query} onChange={setQuery} parts={parts} large />

        <ChipRow label="Bike brand" items={BRANDS} active={query.vehicle} onPick={(v) => pick('vehicle', v)} />
        <ChipRow label="Part type" items={TYPES} active={query.part} onPick={(v) => pick('part', v)} />

        {error && <ErrorNote>Could not load parts: {error}</ErrorNote>}
        {loading && (
          <div className="space-y-3" aria-label="Loading parts">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        )}

        {!loading && !error && !searching && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{lang === 'hi' ? 'ऐसे खोजें' : 'Try searching'}</h2>
            <p className="mb-3 text-sm text-slate-600">Pick a brand or part type above, type, speak, or take a photo. Or tap an example:</p>
            <div className="flex flex-wrap gap-2">
              {examples.map((e) => (
                <button key={e} onClick={() => setQuery({ vehicle: '', part: '', any: e })} className="h-11 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 active:bg-slate-200">
                  “{e}”
                </button>
              ))}
            </div>
          </section>
        )}

        {!loading && !error && searching && (
          <div className="flex items-center justify-between text-sm text-slate-600" aria-live="polite">
            <span>
              {results.length} result{results.length === 1 ? '' : 's'}
            </span>
            <button onClick={() => setQuery(emptyQuery)} className="h-10 px-2 font-semibold text-brand underline">
              Clear search
            </button>
          </div>
        )}

        <ul className="space-y-3">
          {results.slice(0, 60).map((p) => (
            <li key={p.id}>
              <button onClick={() => nav(`/m/part/${p.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:bg-slate-50">
                <PartImage src={p.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{p.name}</span>
                  <span className="block truncate text-sm text-slate-500">{p.compatible_models.join(', ') || p.company}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StockBadge part={p} />
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                      <PinIcon className="h-4 w-4" />
                      Shelf {p.shelf_location ?? '-'}
                    </span>
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
        {!loading && searching && results.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-slate-600">
            <p className="font-semibold text-slate-800">No parts match.</p>
            <p className="text-sm">Try fewer words, another spelling, or a different brand.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export function MobilePart() {
  const { id } = useParams();
  const nav = useNavigate();
  const { parts, loading } = useParts();
  const part = parts.find((p) => p.id === id);
  return (
    <div className="mx-auto min-h-screen max-w-lg">
      <Header back />
      <main className="p-4">
        {loading && !part && <div className="h-64 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading" />}
        {!loading && !part && <ErrorNote>Part not found.</ErrorNote>}
        {part && (
          <PartDetail
            part={part}
            sticky
            onCheckedOut={(msg) => nav('/m', { state: { toast: msg } })} // back to the home screen after checkout
            onOpenPart={(pid) => nav(`/m/part/${pid}`)}
          />
        )}
      </main>
    </div>
  );
}
