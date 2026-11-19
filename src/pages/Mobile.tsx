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

export function MobileHome() {
  const { parts, loading, error } = useParts();
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

  const examples = lang === 'hi' ? EXAMPLES_HI : EXAMPLES;

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-40">
      <Header />
      <ConfigWarning />
      <main className="space-y-3 p-3">
        {toast && (
          <div role="status" className="flex items-start justify-between gap-3 rounded-xl bg-green-100 p-3 font-semibold text-green-900">
            <span>{toast}</span>
            <button onClick={() => setToast(null)} className="-mr-1 -mt-1 h-9 w-9 shrink-0 text-2xl leading-none" aria-label="Dismiss">
              ×
            </button>
          </div>
        )}

        <SearchPanel query={query} onChange={setQuery} parts={parts} large />

        {error && <ErrorNote>Could not load parts: {error}</ErrorNote>}
        {loading && (
          <div className="space-y-3" aria-label="Loading parts">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        )}

        {!loading && !error && !searching && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500">{lang === 'hi' ? 'आज़माएँ:' : 'Try:'}</span>
            {examples.map((e) => (
              <button key={e} onClick={() => setQuery({ vehicle: '', part: '', any: e })} className="h-10 rounded-full bg-slate-100 px-3 text-sm font-medium text-slate-800 active:bg-slate-200">
                {e}
              </button>
            ))}
          </div>
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
