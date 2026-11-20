import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { amountInWords, inr } from '../lib/invoice';
import type { Invoice, InvoiceItem } from '../lib/types';

type Paper = 'a4' | 'thermal';

/** The bill itself. Same component is used for the on-screen preview and the printed page. */
export function InvoiceDoc({ inv, items, paper }: { inv: Invoice; items: InvoiceItem[]; paper: Paper }) {
  const c = inv.company_snapshot;
  const gst = inv.gst_enabled;
  const thermal = paper === 'thermal';
  const width = thermal ? `${c.thermal_width_mm - 6}mm` : '190mm';
  const date = new Date(inv.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const half = (n: number) => Math.round((n / 2) * 100) / 100;

  if (thermal) {
    return (
      <div style={{ width, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', lineHeight: 1.35, color: '#000' }}>
        <div className="text-center">
          <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.company_name}</div>
          {c.address && <div>{c.address}</div>}
          {c.phone && <div>Ph: {c.phone}</div>}
          {gst && c.gstin && <div>GSTIN: {c.gstin}</div>}
          <div style={{ fontWeight: 700, marginTop: 4 }}>{gst ? 'TAX INVOICE' : 'BILL'}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
        <div>No: {inv.invoice_number}</div>
        <div>{date}</div>
        {inv.customer_name && <div>Customer: {inv.customer_name}</div>}
        {inv.vehicle_registration && <div>Vehicle: {inv.vehicle_registration}</div>}
        {gst && inv.customer_gstin && <div>GSTIN: {inv.customer_gstin}</div>}
        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
        {items.map((i) => (
          <div key={i.id} style={{ marginBottom: 3 }}>
            <div>{i.name}</div>
            <div className="flex justify-between">
              <span>
                {i.quantity} x {i.unit_price.toFixed(2)}
                {gst ? ` (GST ${i.gst_rate}%)` : ''}
              </span>
              <span>{i.line_total.toFixed(2)}</span>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />
        {gst && (
          <>
            <Row l="Taxable" r={inv.subtotal.toFixed(2)} />
            <Row l="CGST" r={half(inv.tax_total).toFixed(2)} />
            <Row l="SGST" r={(inv.tax_total - half(inv.tax_total)).toFixed(2)} />
          </>
        )}
        <div className="flex justify-between" style={{ fontSize: '13px', fontWeight: 700 }}>
          <span>TOTAL</span>
          <span>{inr(inv.total)}</span>
        </div>
        <div style={{ marginTop: 4 }}>{amountInWords(inv.total)}</div>
        {c.footer_note && <div className="text-center" style={{ marginTop: 8 }}>{c.footer_note}</div>}
      </div>
    );
  }

  return (
    <div style={{ width, fontFamily: 'IBM Plex Sans, system-ui, sans-serif', fontSize: '12px', color: '#000', lineHeight: 1.4 }}>
      <div className="flex items-start justify-between" style={{ borderBottom: '2px solid #000', paddingBottom: 8 }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>{c.company_name}</div>
          {c.address && <div style={{ whiteSpace: 'pre-line' }}>{c.address}</div>}
          <div>{[c.phone && `Ph: ${c.phone}`, c.email].filter(Boolean).join('  ·  ')}</div>
          {gst && c.gstin && <div style={{ fontWeight: 600 }}>GSTIN: {c.gstin}</div>}
        </div>
        <div className="text-right">
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{gst ? 'TAX INVOICE' : 'BILL'}</div>
          <div>No: <b>{inv.invoice_number}</b></div>
          <div>{date}</div>
        </div>
      </div>

      <div style={{ margin: '10px 0' }}>
        <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase' }}>Billed to</div>
        <div style={{ fontWeight: 600 }}>{inv.customer_name || 'Walk-in customer'}</div>
        {inv.customer_phone && <div>Ph: {inv.customer_phone}</div>}
        {inv.vehicle_registration && <div>Vehicle: {inv.vehicle_registration}</div>}
        {gst && inv.customer_gstin && <div>GSTIN: {inv.customer_gstin}</div>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#eee', textAlign: 'left' }}>
            {['#', 'Item', 'Qty', 'Rate', ...(gst ? ['Taxable', 'GST %'] : []), 'Amount'].map((h, k) => (
              <th key={h} style={{ padding: '5px 6px', textAlign: k > 1 ? 'right' : 'left', border: '1px solid #bbb' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((i, k) => (
            <tr key={i.id}>
              <td style={cell}>{k + 1}</td>
              <td style={cell}>
                {i.name}
                {i.sku && <div style={{ fontSize: '10px', color: '#666' }}>{i.sku}</div>}
              </td>
              <td style={{ ...cell, textAlign: 'right' }}>{i.quantity}</td>
              <td style={{ ...cell, textAlign: 'right' }}>{i.unit_price.toFixed(2)}</td>
              {gst && <td style={{ ...cell, textAlign: 'right' }}>{i.taxable_value.toFixed(2)}</td>}
              {gst && <td style={{ ...cell, textAlign: 'right' }}>{i.gst_rate}%</td>}
              <td style={{ ...cell, textAlign: 'right' }}>{i.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end" style={{ marginTop: 8 }}>
        <table style={{ minWidth: '60mm' }}>
          <tbody>
            {gst && (
              <>
                <Tr l="Taxable value" r={inr(inv.subtotal)} />
                <Tr l="CGST" r={inr(half(inv.tax_total))} />
                <Tr l="SGST" r={inr(inv.tax_total - half(inv.tax_total))} />
              </>
            )}
            <Tr l="Total" r={inr(inv.total)} bold />
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 6 }}>
        <b>Amount in words:</b> {amountInWords(inv.total)}
      </div>
      {gst && <div style={{ marginTop: 4, fontSize: '10px', color: '#555' }}>Tax shown as CGST + SGST (same-state sale).</div>}
      <div className="flex items-end justify-between" style={{ marginTop: 30 }}>
        <div>{c.footer_note}</div>
        <div className="text-right" style={{ borderTop: '1px solid #000', paddingTop: 4, minWidth: '45mm' }}>For {c.company_name}</div>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = { padding: '5px 6px', border: '1px solid #ccc', verticalAlign: 'top' };
const Row = ({ l, r }: { l: string; r: string }) => (
  <div className="flex justify-between">
    <span>{l}</span>
    <span>{r}</span>
  </div>
);
const Tr = ({ l, r, bold = false }: { l: string; r: string; bold?: boolean }) => (
  <tr style={bold ? { fontWeight: 700, fontSize: '14px' } : undefined}>
    <td style={{ padding: '2px 12px 2px 0' }}>{l}</td>
    <td style={{ padding: '2px 0', textAlign: 'right' }}>{r}</td>
  </tr>
);

/** Full-screen preview with the paper-size choice and a Print button. */
export default function InvoiceView({ inv, items, onClose }: { inv: Invoice; items: InvoiceItem[]; onClose: () => void }) {
  const [paper, setPaper] = useState<Paper>(inv.company_snapshot.paper_size);
  const mm = inv.company_snapshot.thermal_width_mm;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => void (document.body.style.overflow = prev);
  }, []);

  function print() {
    const css = document.createElement('style');
    css.textContent = paper === 'a4' ? '@page { size: A4; margin: 10mm; }' : `@page { size: ${mm}mm auto; margin: 3mm; }`;
    document.head.appendChild(css);
    const done = () => {
      css.remove();
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-200">
        <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 shadow">
          <button onClick={onClose} className="h-11 rounded-xl bg-slate-100 px-4 font-semibold">
            Close
          </button>
          <div className="font-display text-xl font-bold uppercase">{inv.invoice_number}</div>
          <div className="ml-auto flex items-center gap-2">
            <select value={paper} onChange={(e) => setPaper(e.target.value as Paper)} className="h-11 rounded-xl border border-slate-300 bg-white px-3" aria-label="Paper size">
              <option value="a4">A4 paper</option>
              <option value="thermal">Thermal {mm} mm</option>
            </select>
            <button onClick={print} className="h-11 rounded-xl bg-brand px-6 font-bold text-white active:scale-95">
              Print / Save PDF
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto w-fit bg-white p-[10mm] shadow-lg" style={{ maxWidth: '100%' }}>
            <InvoiceDoc inv={inv} items={items} paper={paper} />
          </div>
        </div>
      </div>
      {createPortal(
        <div className="print-only">
          <InvoiceDoc inv={inv} items={items} paper={paper} />
        </div>,
        document.body,
      )}
    </>
  );
}
