import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Part } from '../lib/types';
import { ErrorNote, Field, Modal, inputCls } from './ui';

/** After a successful checkout, `onDone` is called with a confirmation message and the parent leaves the part screen. */
export default function CheckoutSheet({ part, onClose, onDone }: { part: Part; onClose: () => void; onDone: (msg: string) => void }) {
  const { displayName } = useAuth(); // the signed-in account is the mechanic: nothing to type
  const [reg, setReg] = useState('');
  const [job, setJob] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (qty < 1 || qty > part.quantity_available) return setError(`Quantity must be between 1 and ${part.quantity_available}.`);
    setBusy(true);
    // One atomic database call: reduces stock AND writes the audit log, or does neither.
    const { error } = await supabase.rpc('checkout_part', {
      p_part_id: part.id,
      p_quantity: qty,
      p_mechanic_name: displayName || null, // the database uses the account's own name
      p_vehicle_registration: reg.trim() || null,
      p_job_reference: job.trim() || null,
    });
    setBusy(false);
    if (error) return setError(error.message);
    const left = part.quantity_available - qty;
    onDone(`✓ ${qty} × ${part.name} checked out${reg.trim() ? ` for ${reg.trim().toUpperCase()}` : ''}. ${left} left on the shelf.`);
  }

  return (
    <Modal title="Checkout part" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-slate-100 p-3 text-sm">
          <div className="font-semibold">{part.name}</div>
          <div className="text-slate-600">
            {part.sku} · {part.quantity_available} available · Shelf {part.shelf_location ?? '-'}
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Logged under <b className="text-slate-900">{displayName || 'your account'}</b>
        </p>
        <Field label="Quantity">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="h-14 w-14 rounded-xl bg-slate-200 text-3xl font-bold active:scale-95" aria-label="One less">
              −
            </button>
            <output className="w-14 text-center font-display text-4xl font-bold" aria-live="polite">
              {qty}
            </output>
            <button type="button" onClick={() => setQty(Math.min(part.quantity_available, qty + 1))} className="h-14 w-14 rounded-xl bg-slate-200 text-3xl font-bold active:scale-95" aria-label="One more">
              +
            </button>
          </div>
        </Field>
        <Field label="Vehicle registration (optional, e.g. MH31AB1234)">
          <input id="reg" className={inputCls + ' uppercase'} value={reg} onChange={(e) => setReg(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Repair job / job card no. (optional)">
          <input id="job" className={inputCls} value={job} onChange={(e) => setJob(e.target.value)} autoComplete="off" />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button disabled={busy} className="h-14 w-full rounded-xl bg-brand text-lg font-bold text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Confirm checkout'}
        </button>
      </form>
    </Modal>
  );
}
