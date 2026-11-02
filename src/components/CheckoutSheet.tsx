import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { ErrorNote, Field, Modal, inputCls } from './ui';

const NAME_KEY = 'sunil.mechanicName';

/** After a successful checkout, `onDone` is called with a confirmation message and the parent leaves the part screen. */
export default function CheckoutSheet({ part, onClose, onDone }: { part: Part; onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [reg, setReg] = useState('');
  const [job, setJob] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Your name is required.');
    if (qty < 1 || qty > part.quantity_available) return setError(`Quantity must be between 1 and ${part.quantity_available}.`);
    setBusy(true);
    // One atomic database call: reduces stock AND writes the audit log, or does neither.
    const { error } = await supabase.rpc('checkout_part', {
      p_part_id: part.id,
      p_quantity: qty,
      p_mechanic_name: name,
      p_vehicle_registration: reg.trim() || null,
      p_job_reference: job || null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* private mode: fine */
    }
    const left = part.quantity_available - qty;
    onDone(`✓ ${qty} × ${part.name} checked out${reg.trim() ? ` for ${reg.trim().toUpperCase()}` : ''}. ${left} left on the shelf.`);
  }

  return (
    <Modal title="Checkout part" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-xl bg-slate-100 p-3 text-sm">
          <b>{part.name}</b> · {part.sku} · {part.quantity_available} available
        </p>
        <Field label="Mechanic name *">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </Field>
        <Field label="Vehicle registration (optional, e.g. MH31AB1234)">
          <input className={inputCls + ' uppercase'} value={reg} onChange={(e) => setReg(e.target.value)} />
        </Field>
        <Field label="Repair job reference / job card no.">
          <input className={inputCls} value={job} onChange={(e) => setJob(e.target.value)} />
        </Field>
        <Field label="Quantity">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="h-14 w-14 rounded-xl bg-slate-200 text-2xl font-bold">
              −
            </button>
            <span className="w-12 text-center text-2xl font-bold">{qty}</span>
            <button type="button" onClick={() => setQty(Math.min(part.quantity_available, qty + 1))} className="h-14 w-14 rounded-xl bg-slate-200 text-2xl font-bold">
              +
            </button>
          </div>
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button disabled={busy} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Confirm checkout'}
        </button>
      </form>
    </Modal>
  );
}
