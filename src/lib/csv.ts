import Papa from 'papaparse';
import type { PartInput } from './types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Column header (normalised) -> field. Matches the shop's spreadsheet headers and simple variants.
const ALIASES: Record<string, string> = {
  skunumber: 'sku', sku: 'sku', skuno: 'sku',
  partname: 'name', name: 'name',
  companyname: 'company', company: 'company', brand: 'company',
  partcategory: 'category', category: 'category',
  description: 'description',
  dimension: 'dimension', size: 'dimension',
  shelflocation: 'shelf_location', shelf: 'shelf_location', rack: 'shelf_location',
  quantityavailable: 'quantity_available', qty: 'quantity_available',
  stockquantity: 'stock_quantity',
  minstock: 'min_stock',
  price: 'price', mrp: 'price',
  linkofphotoofpart: 'image_url', imageurl: 'image_url', photo: 'image_url', image: 'image_url',
  vehiclemodel: 'vehicle_model', model: 'vehicle_model',
  compatiblemodels: 'compatible_models',
};

export interface ParsedImport {
  rows: PartInput[];
  skipped: string[]; // human-readable reasons
}

const int = (v: unknown, d = 0) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

export function parseCsv(file: File): Promise<ParsedImport> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => ALIASES[norm(h)] ?? norm(h),
      complete: ({ data, meta }) => {
        const fields = meta.fields ?? [];
        if (!fields.includes('sku') || !fields.includes('name'))
          return reject(new Error('CSV needs at least "sku number" (or sku) and "part_name" columns.'));
        const rows = new Map<string, PartInput>();
        const skipped: string[] = [];
        data.forEach((r, i) => {
          const sku = (r.sku ?? '').trim();
          const name = (r.name ?? '').trim();
          if (!sku || !name) return void skipped.push(`Row ${i + 2}: missing SKU or part name`);
          const explicit = (r.compatible_models ?? '').split(/[;|,]/).map((m) => m.trim()).filter(Boolean);
          const models = explicit.length ? explicit : r.vehicle_model ? [r.vehicle_model.trim()] : [];
          rows.set(sku, {
            sku,
            name,
            company: r.company?.trim() || null,
            category: r.category?.trim() || null,
            description: r.description?.trim() || null,
            dimension: r.dimension?.trim() || null,
            compatible_models: models,
            shelf_location: r.shelf_location?.trim() || null,
            quantity_available: int(r.quantity_available ?? r.stock_quantity),
            min_stock: int(r.min_stock, 2),
            price: r.price ? Number(String(r.price).replace(/[^0-9.]/g, '')) || null : null,
            image_url: r.image_url?.trim() || null,
          });
        });
        resolve({ rows: [...rows.values()], skipped });
      },
      error: (e) => reject(new Error(e.message)),
    });
  });
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([Papa.unparse(rows)], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
