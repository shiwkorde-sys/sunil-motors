import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Part, PartInput } from '../lib/types';
import { ErrorNote, Field, Modal, inputCls } from './ui';

const blank: PartInput = {
  sku: '', name: '', company: '', category: '', description: '', dimension: '',
  compatible_models: [], shelf_location: '', quantity_available: 0, min_stock: 2, price: null, image_url: '',
};

export default function PartForm({ part, onClose, onSaved }: { part?: Part; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<PartInput>(part ? { ...blank, ...part } : blank);
  const [models, setModels] = useState((part?.compatible_models ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof PartInput>(k: K, v: PartInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const text = (k: 'sku' | 'name' | 'company' | 'category' | 'description' | 'dimension' | 'shelf_location' | 'image_url') => ({
    className: inputCls,
    value: f[k] ?? '',
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const row = {
      ...f,
      sku: f.sku.trim(),
      name: f.name.trim(),
      compatible_models: models.split(/[,;|]/).map((m) => m.trim()).filter(Boolean),
      image_url: f.image_url?.trim() || null,
    };
    const { error } = part ? await supabase.from('parts').update(row).eq('id', part.id) : await supabase.from('parts').insert(row);
    setBusy(false);
    if (error) return setError(error.code === '23505' ? 'That SKU already exists.' : error.message);
    onSaved();
    onClose();
  }

  return (
    <Modal title={part ? 'Edit part' : 'Add part'} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="SKU *"><input {...text('sku')} required /></Field>
        <Field label="Part name *"><input {...text('name')} required /></Field>
        <Field label="Company"><input {...text('company')} /></Field>
        <Field label="Category"><input {...text('category')} /></Field>
        <div className="sm:col-span-2">
          <Field label="Compatible models (comma separated — add every bike it fits)">
            <input className={inputCls} value={models} onChange={(e) => setModels(e.target.value)} placeholder="Activa 6G, Aviator" />
          </Field>
        </div>
        <Field label="Shelf location"><input {...text('shelf_location')} placeholder="R1-B02-S1" /></Field>
        <Field label="Size / dimension"><input {...text('dimension')} /></Field>
        <Field label="Quantity available">
          <input type="number" min={0} className={inputCls} value={f.quantity_available} onChange={(e) => set('quantity_available', Math.max(0, +e.target.value || 0))} />
        </Field>
        <Field label="Low-stock alert at">
          <input type="number" min={0} className={inputCls} value={f.min_stock} onChange={(e) => set('min_stock', Math.max(0, +e.target.value || 0))} />
        </Field>
        <div className="sm:col-span-2"><Field label="Photo link (URL)"><input {...text('image_url')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description"><textarea rows={2} className={inputCls} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field></div>
        {error && <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div>}
        <button disabled={busy} className="h-12 rounded-xl bg-brand font-bold text-white disabled:opacity-60 sm:col-span-2">
          {busy ? 'Saving…' : 'Save part'}
        </button>
      </form>
    </Modal>
  );
}
