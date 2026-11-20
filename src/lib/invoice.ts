import type { Invoice, InvoiceItem } from './types';

/** Postgres sends numeric columns as text; turn them into real numbers. */
export const toInvoice = (r: Record<string, unknown>): Invoice => ({
  ...(r as unknown as Invoice),
  subtotal: Number(r.subtotal),
  tax_total: Number(r.tax_total),
  total: Number(r.total),
});
export const toItem = (r: Record<string, unknown>): InvoiceItem => ({
  ...(r as unknown as InvoiceItem),
  unit_price: Number(r.unit_price),
  gst_rate: Number(r.gst_rate),
  taxable_value: Number(r.taxable_value),
  tax_amount: Number(r.tax_amount),
  line_total: Number(r.line_total),
});

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Same maths as the database function create_invoice(), so the preview matches the saved bill. */
export function calcLine(qty: number, price: number, rate: number, gst: boolean, inclusive: boolean) {
  const gross = Math.round(price * qty * 100) / 100;
  if (!gst) return { taxable: gross, tax: 0, total: gross };
  if (inclusive) {
    const taxable = Math.round((gross / (1 + rate / 100)) * 100) / 100;
    return { taxable, tax: Math.round((gross - taxable) * 100) / 100, total: gross };
  }
  const tax = Math.round(gross * rate) / 100;
  return { taxable: gross, tax, total: Math.round((gross + tax) * 100) / 100 };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const below1000 = (n: number) => (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '') : below100(n));

/** 1234.5 -> "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only" (Indian lakh/crore style). */
export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount + 1e-9);
  const paise = Math.round((amount - rupees) * 100);
  const parts: string[] = [];
  let n = rupees;
  for (const [div, label] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']] as const) {
    if (n >= div) {
      parts.push(below1000(Math.floor(n / div)) + ' ' + label);
      n %= div;
    }
  }
  if (n > 0) parts.push(below1000(n));
  const r = parts.join(' ') || 'Zero';
  return `Rupees ${r}${paise ? ' and ' + below100(paise) + ' Paise' : ''} Only`;
}
