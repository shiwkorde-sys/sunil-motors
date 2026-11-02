import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { setLang, useLang } from '../lib/lang';
import { emptyQuery, isSearching, searchParts, type Query } from '../lib/search';
import { useParts } from '../lib/useParts';
import PartDetail from '../components/PartDetail';
import SearchPanel from '../components/SearchPanel';
import { ConfigWarning, ErrorNote, PartImage, StockBadge } from '../components/ui';

function Header({ back }: { back?: boolean }) {
  const { isAdmin, signOut, profile } = useAuth();
  const lang = useLang();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-brand px-4 py-3 text-white">
      {back ? (
        <Link to="/m" className="text-lg font-bold">
          ← Back
        </Link>
      ) : (
        <span className="text-lg font-extrabold">🏍️ Sunil Motors</span>
      )}
      <div className="flex items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-lg bg-white/20" role="group" aria-label="Audio language">
          {(['hi', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-2.5 py-1.5 ${lang === l ? 'bg-white font-bold text-brand' : ''}`}>
              {l === 'hi' ? 'हिन्दी' : 'EN'}
            </button>
          ))}
        </div>
        {isAdmin && (
          <Link to="/dashboard" className="underline">
            Admin
          </Link>
        )}
        <button onClick={signOut} className="rounded-lg bg-white/20 px-3 py-1.5" title={profile?.email ?? ''}>
          Sign out
        </button>
      </div>
    </header>
  );
}

export function MobileHome() {
  const { parts, loading, error } = useParts();
  const [query, setQuery] = useState<Query>(emptyQuery);
  const nav = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState<string | null>((location.state as { toast?: string } | null)?.toast ?? null);

  // Show the "checked out" message for a few seconds, then clear it (and the router state, so a refresh won't repeat it).
  useEffect(() => {
    if (!toast) return;
    nav('/m', { replace: true, state: null });
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast, nav]);

  const searching = isSearching(query);
  const results = useMemo(() => (searching ? searchParts(parts, query) : []), [parts, query, searching]);

  return (
    <div className="mx-auto min-h-screen max-w-lg pb-44">
      <Header />
      <ConfigWarning />
      <main className="space-y-4 p-4">
        {toast && (
          <div role="status" className="rounded-xl bg-green-100 p-3 font-semibold text-green-800">
            {toast}
          </div>
        )}
        <SearchPanel query={query} onChange={setQuery} parts={parts} large />
        {error && <ErrorNote>Could not load parts: {error}</ErrorNote>}
        {loading && <p className="py-6 text-center text-slate-500">Loading parts…</p>}
        {!loading && !error && (
          <p className="text-sm text-slate-500">
            {searching ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'Search by vehicle or part name, or use Camera or Voice below.'}
          </p>
        )}
        <ul className="space-y-3">
          {results.slice(0, 60).map((p) => (
            <li key={p.id}>
              <button onClick={() => nav(`/m/part/${p.id}`)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm active:scale-[.99]">
                <PartImage src={p.image_url} alt="" className="h-20 w-20 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-tight">{p.name}</span>
                  <span className="block truncate text-sm text-slate-500">{p.compatible_models.join(', ') || p.company}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <StockBadge part={p} />
                    <span className="text-xs text-slate-500">📍 {p.shelf_location ?? '—'}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!loading && searching && results.length === 0 && (
          <p className="rounded-xl bg-white p-6 text-center text-slate-600">No parts match. Try fewer words or a different spelling.</p>
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
    <div className="mx-auto min-h-screen max-w-lg pb-10">
      <Header back />
      <main className="p-4">
        {loading && !part && <p className="py-10 text-center text-slate-500">Loading…</p>}
        {!loading && !part && <ErrorNote>Part not found.</ErrorNote>}
        {part && (
          <PartDetail
            part={part}
            onCheckedOut={(msg) => nav('/m', { state: { toast: msg } })} // back to the home screen after checkout
            onOpenPart={(pid) => nav(`/m/part/${pid}`)}
          />
        )}
      </main>
    </div>
  );
}
