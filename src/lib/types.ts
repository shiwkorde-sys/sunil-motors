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
