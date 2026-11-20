export interface Part {
  id: string;
  sku: string;
  name: string;
  company: string | null;
  category: string | null;
  description: string | null;
  dimension: string | null;
  compatible_models: string[];
  shelf_location: string | null;
  quantity_available: number;
  min_stock: number;
  price: number | null;
  image_url: string | null;
}

export type PartInput = Omit<Part, 'id'>;

export interface Checkout {
  id: string;
  part_id: string;
  sku: string;
  part_name: string;
  quantity: number;
  mechanic_name: string;
  vehicle_registration: string | null;
  job_reference: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'staff';
}

export interface CompanySettings {
  id: number;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  default_gst_rate: number;
  gst_default_on: boolean;
  prices_include_gst: boolean;
  paper_size: 'a4' | 'thermal';
  thermal_width_mm: 58 | 80;
  invoice_prefix: string;
  next_invoice_number: number;
  footer_note: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  vehicle_registration: string | null;
  gst_enabled: boolean;
  prices_include_gst: boolean;
  subtotal: number;
  tax_total: number;
  total: number;
  company_snapshot: CompanySettings;
  created_by_name: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  part_id: string | null;
  checkout_id: string | null;
  sku: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  taxable_value: number;
  tax_amount: number;
  line_total: number;
}
