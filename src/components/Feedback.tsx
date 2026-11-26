import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { CheckBadge } from './motion';
import { ErrorNote, Field, Modal, inputCls } from './ui';

const LABELS = ['', 'Needs work', 'Not great', 'Okay', 'Good', 'Love it'];

const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
    <path d="m12 3.2 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill={on ? '#ff9f0a' : 'none'} stroke={on ? '#ff9f0a' : '#c7c7cc'} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/** Sidebar button + sheet: a rating and an optional note, saved for the owner to read. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-10 w-full items-center justify-between rounded-[10px] border border-black/[0.08] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] hover:border-[#0071e3] hover:text-[#0071e3]">
        <span>Share feedback</span>
        <span className="text-[#86868b]" aria-hidden="true">→</span>
      </button>
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(onClose, 2200);
    return () => clearTimeout(t);
  }, [sent, onClose]);

  async function send() {
    if (!rating) return setErr('Tap a star first so we know how it felt.');
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from('app_feedback').insert({ rating, comment: comment.trim() || null, page: window.location.hash.slice(1) || 'overview', user_name: profile?.full_name || profile?.email || null });
    setBusy(false);
    if (error) return setErr("We couldn't send that just now. Your note is still here, so please try again in a moment.");
    setSent(true);
  }

  const shown = hover || rating;
  return (
    <Modal title="How is it working for you?" onClose={() => !busy && onClose()}>
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckBadge className="h-14 w-14" />
          <p className="text-lg font-semibold">Thank you.</p>
          <p className="text-sm text-slate-500">Every note gets read.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <m.button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n]}`}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  className="rounded-lg p-1"
                >
                  <Star on={n <= shown} />
                </m.button>
              ))}
            </div>
            <p className="mt-1 h-5 text-center text-sm font-medium text-slate-500" aria-live="polite">{LABELS[shown]}</p>
          </div>
          <Field label="What could be better? (optional)">
            <textarea className={`${inputCls} min-h-[96px] resize-y`} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder="Anything slow, confusing, or missing?" />
          </Field>
          {err && <ErrorNote>{err}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={busy} className="h-11 rounded-full border px-5 font-semibold">Not now</button>
            <button onClick={send} disabled={busy} className="h-11 rounded-full bg-brand px-6 font-semibold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface Row { id: string; created_at: string; user_name: string | null; rating: number; comment: string | null; page: string | null }

/** Admin-only list of what people sent. */
export function FeedbackInbox() {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    supabase.from('app_feedback').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  if (!rows) return null;
  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : null;
  return (
    <section className="card p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-bold tracking-tight">Feedback from your team</h2>
        {avg && <span className="num text-sm text-slate-500">{avg} / 5 average</span>}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing yet. Use "Share feedback" in the sidebar to leave the first note.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{r.user_name || 'Someone'} <span className="font-normal text-slate-500">on {r.page || 'the app'}</span></span>
                <span className="whitespace-nowrap text-[#ff9f0a]" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}<span className="text-[#d2d2d7]">{'★'.repeat(5 - r.rating)}</span></span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-slate-700">{r.comment}</p>}
              <p className="mt-1 text-xs text-slate-400">{new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
