import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { EyeIcon } from '../components/icons';
import { ErrorNote, Field, inputCls } from '../components/ui';

/** Opened from the link in the "reset password" email. Supabase signs the person in with that link, then they pick a new password. */
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [waited, setWaited] = useState(false);

  // Give Supabase a moment to read the link before deciding it is invalid.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 6) return setErr('Use at least 6 characters.');
    if (pw !== pw2) return setErr('The two passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setDone(true);
    setTimeout(() => nav('/', { replace: true }), 1500);
  }

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <div className="text-center font-display text-4xl font-bold uppercase leading-none tracking-wide text-brand">Sunil Motors Garage</div>
      <div className="rounded-2xl bg-white p-5 shadow">{children}</div>
    </div>
  );

  if (!session) {
    if (loading || !waited) return shell(<p className="py-6 text-center text-slate-500">Checking your link…</p>);
    return shell(
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold uppercase">Link expired</h1>
        <p className="text-sm text-slate-600">This reset link is old or was already used. Request a new one from the sign-in page.</p>
        <Link to="/login" className="flex h-14 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
          Back to sign in
        </Link>
      </div>,
    );
  }

  if (done)
    return shell(
      <div role="status" className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-bold uppercase">Password changed</h1>
        <p className="text-sm text-slate-600">Taking you to the app…</p>
      </div>,
    );

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">Choose a new password</h1>
        <p className="text-sm text-slate-600">Signed in as {session.user.email}</p>
      </div>
      <Field label="New password">
        <div className="relative">
          <input id="pw" type={show ? 'text' : 'password'} className={inputCls + ' pr-14'} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-500" aria-label={show ? 'Hide password' : 'Show password'}>
            <EyeIcon className="h-5 w-5" off={show} />
          </button>
        </div>
      </Field>
      <Field label="Type it again">
        <input id="pw2" type={show ? 'text' : 'password'} className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} autoComplete="new-password" />
      </Field>
      {err && <ErrorNote>{err}</ErrorNote>}
      <button disabled={busy} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-60">
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>,
  );
}
