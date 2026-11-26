import { useToast } from '../lib/toast';
import { FeedbackInbox } from './Feedback';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { CompanySettings } from '../lib/types';
import { ErrorNote, Field, inputCls } from './ui';

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

export default function SettingsPanel() {
  const [s, setS] = useState<CompanySettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('company_settings').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (error) setErr(error.message);
      else setS({ ...(data as CompanySettings), default_gst_rate: num(data.default_gst_rate, 18) });
    });
  }, []);

  if (!s) return err ? <ErrorNote>{err}. Has the invoices update been applied to the database?</ErrorNote> : <p className="text-slate-500">Getting your settings…</p>;
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) => {
    setS({ ...s, [k]: v });
    setSaved(false);
  };
  const text = (k: 'company_name' | 'address' | 'phone' | 'email' | 'gstin' | 'invoice_prefix' | 'footer_note') => ({
    className: inputCls,
    value: s[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value),
  });

  async function save() {
    if (!s) return;
    if (!s.company_name.trim()) return setErr('Company name is required.');
    if (s.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s.gstin.trim().toUpperCase())) return setErr('That GST number does not look right. It has 15 letters and numbers, like 27ABCDE1234F1Z5. Leave it empty if you have none.');
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from('company_settings')
      .update({
        company_name: s.company_name.trim(),
        address: s.address?.trim() || null,
        phone: s.phone?.trim() || null,
        email: s.email?.trim() || null,
        gstin: s.gstin?.trim().toUpperCase() || null,
        default_gst_rate: s.default_gst_rate,
        gst_default_on: s.gst_default_on,
        prices_include_gst: s.prices_include_gst,
        paper_size: s.paper_size,
        thermal_width_mm: s.thermal_width_mm,
        invoice_prefix: s.invoice_prefix.trim() || 'INV',
        footer_note: s.footer_note?.trim() || null,
      })
      .eq('id', 1);
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setSaved(true);
      toast.success('Settings saved.');
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-slate-500">These details appear on every bill. Bills already made keep the details they were made with.</p>
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Company</h2>
        <Field label="Company name"><input {...text('company_name')} /></Field>
        <Field label="Address"><textarea {...text('address')} rows={2} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone"><input {...text('phone')} inputMode="tel" /></Field>
          <Field label="Email"><input {...text('email')} inputMode="email" /></Field>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">GST (optional)</h2>
        <Field label="GST number (GSTIN). Leave empty if you do not have one"><input {...text('gstin')} placeholder="27ABCDE1234F1Z5" style={{ textTransform: 'uppercase' }} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Usual GST rate (%)">
            <input className={inputCls} type="number" min={0} max={100} step="0.5" value={s.default_gst_rate} onChange={(e) => set('default_gst_rate', num(e.target.value, 0))} />
          </Field>
          <Field label="Prices in my stock list">
            <select className={inputCls} value={s.prices_include_gst ? 'in' : 'ex'} onChange={(e) => set('prices_include_gst', e.target.value === 'in')}>
              <option value="in">already include GST (MRP)</option>
              <option value="ex">do not include GST</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-3 py-1">
          <input type="checkbox" className="h-5 w-5" checked={s.gst_default_on} onChange={(e) => set('gst_default_on', e.target.checked)} />
          <span>Tick "Add GST" by default on new bills</span>
        </label>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Printing</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Printer / paper">
            <select className={inputCls} value={s.paper_size} onChange={(e) => set('paper_size', e.target.value as CompanySettings['paper_size'])}>
              <option value="a4">Normal printer (A4)</option>
              <option value="thermal">Small receipt printer (thermal)</option>
            </select>
          </Field>
          <Field label="Receipt roll width">
            <select className={inputCls} value={s.thermal_width_mm} onChange={(e) => set('thermal_width_mm', Number(e.target.value) as 58 | 80)} disabled={s.paper_size !== 'thermal'}>
              <option value={80}>80 mm (common)</option>
              <option value={58}>58 mm (small)</option>
            </select>
          </Field>
          <Field label="Bill number starts with"><input {...text('invoice_prefix')} maxLength={8} /></Field>
          <Field label="Next bill number"><input className={inputCls + ' bg-slate-100'} value={`${s.invoice_prefix}-${String(s.next_invoice_number).padStart(5, '0')}`} readOnly /></Field>
        </div>
        <Field label="Message at the bottom of the bill"><input {...text('footer_note')} /></Field>
        <p className="text-xs text-slate-500">You can still change the paper size each time you print.</p>
      </section>

      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="h-12 rounded-xl bg-brand px-8 font-bold text-white active:scale-95 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="anim-pop font-semibold text-green-700">All saved ✓</span>}
      </div>

      <FeedbackInbox />
    </div>
  );
}
