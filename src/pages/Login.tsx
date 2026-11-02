import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { ConfigWarning, ErrorNote, Field, inputCls } from '../components/ui';

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    if (res.error) return setMsg({ text: res.error.message });
    if (mode === 'up' && !res.data.session) setMsg({ text: 'Account created. Check your email to confirm, then sign in.', ok: true });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <ConfigWarning />
      <div className="mb-6 text-center">
        <div className="text-5xl">🏍️</div>
        <h1 className="mt-2 text-2xl font-extrabold text-brand">Sunil Motors Garage</h1>
        <p className="text-slate-500">Spare parts inventory</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow">
        {mode === 'up' && (
          <Field label="Your name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
        )}
        <Field label="Email">
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </Field>
        <Field label="Password">
          <input type="password" minLength={6} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        </Field>
        {msg && (msg.ok ? <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{msg.text}</p> : <ErrorNote>{msg.text}</ErrorNote>)}
        <button disabled={busy} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="w-full text-sm text-slate-600 underline">
          {mode === 'in' ? 'New staff member? Create account' : 'Already have an account? Sign in'}
        </button>
      </form>
      {mode === 'up' && <p className="mt-3 text-center text-xs text-slate-500">The very first account created becomes the admin.</p>}
    </div>
  );
}
