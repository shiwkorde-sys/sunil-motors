import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { EyeIcon } from '../components/icons';
import { ConfigWarning, ErrorNote, Field, inputCls } from '../components/ui';

type Mode = 'in' | 'up' | 'forgot';

const friendly = (m: string) =>
  /rate limit/i.test(m)
    ? 'Too many emails were sent. Please wait an hour, or ask the shop owner to help.'
    : /invalid login/i.test(m)
      ? 'Wrong email or password. Tap "Forgot password?" if you cannot remember it.'
      : m;

export default function Login() {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setMsg(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      return setMsg(
        error
          ? { text: friendly(error.message) }
          : { ok: true, text: 'If this email has an account, a reset link is on its way. Check Inbox and Spam. The link works for 1 hour.' },
      );
    }

    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (res.error) return setMsg({ text: friendly(res.error.message) });
    if (mode === 'up' && !res.data.session) setMsg({ text: 'Account created. Check your email to confirm, then sign in.', ok: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 p-6">
      <ConfigWarning />
      <div className="text-center">
        <div className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-brand">Sunil Motors Garage</div>
        <p className="mt-1 text-sm text-slate-500">Spare parts inventory</p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow">
        {mode === 'forgot' ? (
          <div className="mb-4">
            <h1 className="font-display text-2xl font-bold uppercase">Forgot password?</h1>
            <p className="text-sm text-slate-600">Enter your email. We will send a link to choose a new password.</p>
          </div>
        ) : (
          <div role="tablist" className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            {(['in', 'up'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`h-11 rounded-lg text-sm font-semibold ${mode === m ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
              >
                {m === 'in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'up' && (
            <Field label="Your full name (shown in the Sales list)">
              <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </Field>
          {mode !== 'forgot' && (
            <Field label="Password">
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  minLength={6}
                  className={inputCls + ' pr-14'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-500"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon className="h-5 w-5" off={show} />
                </button>
              </div>
            </Field>
          )}

          {msg && (msg.ok ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg.text}</p> : <ErrorNote>{msg.text}</ErrorNote>)}

          <button disabled={busy} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-3 text-center">
          {mode === 'in' && (
            <button type="button" onClick={() => switchMode('forgot')} className="h-11 px-3 text-sm font-semibold text-brand underline">
              Forgot password?
            </button>
          )}
          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('in')} className="h-11 px-3 text-sm font-semibold text-slate-600 underline">
              Back to sign in
            </button>
          )}
        </div>
      </div>
      {mode === 'up' && <p className="text-center text-xs text-slate-500">The very first account created becomes the admin.</p>}
    </div>
  );
}
