import { useState } from 'react';
import { parseCsv, type ParsedImport } from '../lib/csv';
import { supabase } from '../lib/supabase';
import { ErrorNote } from './ui';

/** Upload many parts at once from a CSV. Same SKU = update, new SKU = add. */
export default function BulkUpload({ reload, onDone }: { reload: () => void; onDone?: () => void }) {
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file?: File) {
    setParsed(null);
    setStatus(null);
    setError(null);
    if (!file) return;
    try {
      setParsed(await parseCsv(file));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    for (let i = 0; i < parsed.rows.length; i += 200) {
      const { error } = await supabase.from('parts').upsert(parsed.rows.slice(i, i + 200), { onConflict: 'sku' });
      if (error) {
        setBusy(false);
        return setError(`Stopped after ${i} rows: ${error.message}`);
      }
      setStatus(`Uploaded ${Math.min(i + 200, parsed.rows.length)} of ${parsed.rows.length}…`);
    }
    setBusy(false);
    setStatus(`Done. ${parsed.rows.length} parts added or updated.`);
    setParsed(null);
    reload();
    onDone?.();
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          Download the blank sheet: <a href="/parts_template.csv" download="Sunil_Motors_Parts_Template.csv" className="font-semibold text-brand underline">parts_template.csv</a>
        </li>
        <li>Fill one row per part. Needed: <b>sku number</b>, <b>part_name</b>, <b>quantity_available</b>. For several bikes use <b>compatible_models</b>, separated with ;</li>
        <li>Save as CSV and choose it below.</li>
      </ol>
      <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">A part whose SKU already exists is <b>updated</b>. A new SKU is <b>added</b>. Nothing is deleted.</p>
      <input type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:h-11 file:rounded-xl file:border-0 file:bg-slate-900 file:px-5 file:font-semibold file:text-white" aria-label="Choose CSV file" />
      {error && <ErrorNote>{error}</ErrorNote>}
      {parsed && (
        <div className="space-y-3">
          <p><b>{parsed.rows.length}</b> parts ready{parsed.skipped.length > 0 && <>, {parsed.skipped.length} rows skipped</>}.</p>
          {parsed.skipped.length > 0 && <ul className="max-h-24 overflow-auto text-xs text-amber-700">{parsed.skipped.map((s) => <li key={s}>{s}</li>)}</ul>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <tbody>{parsed.rows.slice(0, 5).map((r) => <tr key={r.sku} className="border-t"><td className="py-1 pr-2 font-mono">{r.sku}</td><td className="pr-2">{r.name}</td><td className="pr-2">{r.compatible_models.join(', ')}</td><td>{r.quantity_available}</td></tr>)}</tbody>
            </table>
          </div>
          {parsed.rows.length > 5 && <p className="text-xs text-slate-400">Showing the first 5.</p>}
          <button disabled={busy} onClick={run} className="h-12 rounded-xl bg-brand px-6 font-bold text-white active:scale-95 disabled:opacity-60">{busy ? 'Uploading…' : `Upload ${parsed.rows.length} parts`}</button>
        </div>
      )}
      {status && <p className="anim-pop rounded-xl bg-green-50 p-3 font-medium text-green-800">{status}</p>}
    </div>
  );
}
