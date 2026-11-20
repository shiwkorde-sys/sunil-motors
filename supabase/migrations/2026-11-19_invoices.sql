-- Invoices / billing. Safe to run once; everything is "if not exists".
-- Admin-only: settings, invoices and invoice lines can be read/created only by admins.

-- ───────────── Company settings (single row) ─────────────
create table if not exists public.company_settings (
  id integer primary key default 1 check (id = 1),
  company_name text not null default 'Sunil Motors Garage',
  address text,
  phone text,
  email text,
  gstin text,                                              -- optional
  default_gst_rate numeric(5,2) not null default 18 check (default_gst_rate between 0 and 100),
  gst_default_on boolean not null default false,           -- is "Add GST" ticked by default on a new bill
  prices_include_gst boolean not null default true,        -- part prices already include GST (MRP style)
  paper_size text not null default 'a4' check (paper_size in ('a4', 'thermal')),
  thermal_width_mm integer not null default 80 check (thermal_width_mm in (58, 80)),
  invoice_prefix text not null default 'INV',
  next_invoice_number integer not null default 1 check (next_invoice_number >= 1),
  footer_note text default 'Thank you for your business!',
  updated_at timestamptz not null default now()
);
insert into public.company_settings (id) values (1) on conflict (id) do nothing;

-- ───────────── Invoices (never edited after creation) ─────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_name text,
  customer_phone text,
  customer_gstin text,
  vehicle_registration text,
  gst_enabled boolean not null,
  prices_include_gst boolean not null,
  subtotal numeric(12,2) not null,        -- taxable value
  tax_total numeric(12,2) not null,
  total numeric(12,2) not null,
  company_snapshot jsonb not null,        -- company details exactly as they were on the day
  created_by uuid not null default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  part_id uuid references public.parts(id) on delete set null,
  checkout_id uuid unique references public.checkout_transactions(id),   -- a checkout can be billed only once
  sku text,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  gst_rate numeric(5,2) not null default 0,
  taxable_value numeric(12,2) not null,
  tax_amount numeric(12,2) not null,
  line_total numeric(12,2) not null
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

alter table public.company_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

drop policy if exists "admin read settings" on public.company_settings;
drop policy if exists "admin update settings" on public.company_settings;
drop policy if exists "admin read invoices" on public.invoices;
drop policy if exists "admin read invoice items" on public.invoice_items;
create policy "admin read settings"   on public.company_settings for select to authenticated using (public.is_admin());
create policy "admin update settings" on public.company_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read invoices"   on public.invoices         for select to authenticated using (public.is_admin());
create policy "admin read invoice items" on public.invoice_items for select to authenticated using (public.is_admin());
-- No insert/update/delete policies on invoices: they are created only by create_invoice() below.

-- ───────────── Create an invoice (atomic) ─────────────
-- p_items: [{ "checkout_id": uuid, "unit_price": 100, "gst_rate": 18 }          -- bill an existing mechanic checkout (stock already taken)
--           { "part_id": uuid, "quantity": 2, "unit_price": 100, "gst_rate": 18 }]  -- counter sale: takes the stock now
create or replace function public.create_invoice(
  p_customer jsonb,
  p_items jsonb,
  p_gst_enabled boolean
) returns public.invoices
language plpgsql security definer set search_path = public as $$
declare
  s public.company_settings;
  inv public.invoices;
  it jsonb;
  v_part public.parts;
  v_co public.checkout_transactions;
  v_name text;
  v_number text;
  v_qty integer;
  v_price numeric;
  v_rate numeric;
  v_gross numeric;
  v_taxable numeric;
  v_tax numeric;
  v_sub numeric := 0;
  v_taxsum numeric := 0;
  v_vehicle text := nullif(upper(trim(coalesce(p_customer->>'vehicle_registration', ''))), '');
begin
  if not public.is_admin() then raise exception 'Only admins can create invoices'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one item';
  end if;

  select * into s from public.company_settings where id = 1 for update;     -- lock: gives unique, gap-free numbers
  v_number := s.invoice_prefix || '-' || lpad(s.next_invoice_number::text, 5, '0');
  update public.company_settings set next_invoice_number = next_invoice_number + 1 where id = 1;

  select coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1)) into v_name from public.profiles where id = auth.uid();

  insert into public.invoices
    (invoice_number, customer_name, customer_phone, customer_gstin, vehicle_registration,
     gst_enabled, prices_include_gst, subtotal, tax_total, total, company_snapshot, created_by_name)
  values
    (v_number, nullif(trim(coalesce(p_customer->>'name', '')), ''), nullif(trim(coalesce(p_customer->>'phone', '')), ''),
     case when p_gst_enabled then nullif(upper(trim(coalesce(p_customer->>'gstin', ''))), '') end, v_vehicle,
     p_gst_enabled, s.prices_include_gst, 0, 0, 0, to_jsonb(s), v_name)
  returning * into inv;

  for it in select * from jsonb_array_elements(p_items) loop
    v_price := (it->>'unit_price')::numeric;
    v_rate := case when p_gst_enabled then coalesce((it->>'gst_rate')::numeric, s.default_gst_rate) else 0 end;
    if v_price is null or v_price < 0 then raise exception 'Every item needs a price'; end if;
    if v_rate < 0 or v_rate > 100 then raise exception 'GST rate must be between 0 and 100'; end if;

    if it->>'checkout_id' is not null then
      -- bill a checkout that already happened: stock was reduced then, so do not reduce it again
      select * into v_co from public.checkout_transactions where id = (it->>'checkout_id')::uuid for update;
      if not found then raise exception 'Checkout not found'; end if;
      if exists (select 1 from public.invoice_items where checkout_id = v_co.id) then
        raise exception '% is already billed', v_co.part_name;
      end if;
      v_qty := v_co.quantity;
    else
      v_qty := (it->>'quantity')::integer;
      if v_qty is null or v_qty < 1 then raise exception 'Quantity must be at least 1'; end if;
      select * into v_part from public.parts where id = (it->>'part_id')::uuid for update;
      if not found then raise exception 'Part not found'; end if;
      if v_part.quantity_available < v_qty then
        raise exception 'Only % of % in stock', v_part.quantity_available, v_part.name;
      end if;
      update public.parts set quantity_available = quantity_available - v_qty where id = v_part.id;
      insert into public.checkout_transactions
        (part_id, sku, part_name, quantity, mechanic_name, vehicle_registration, job_reference)
      values (v_part.id, v_part.sku, v_part.name, v_qty, coalesce(v_name, 'Counter'), v_vehicle, 'Bill ' || v_number)
      returning * into v_co;
    end if;

    v_gross := round(v_price * v_qty, 2);
    if p_gst_enabled and s.prices_include_gst then
      v_taxable := round(v_gross / (1 + v_rate / 100), 2);
      v_tax := v_gross - v_taxable;
    elsif p_gst_enabled then
      v_taxable := v_gross;
      v_tax := round(v_gross * v_rate / 100, 2);
    else
      v_taxable := v_gross;
      v_tax := 0;
    end if;

    insert into public.invoice_items
      (invoice_id, part_id, checkout_id, sku, name, quantity, unit_price, gst_rate, taxable_value, tax_amount, line_total)
    values (inv.id, v_co.part_id, v_co.id, v_co.sku, v_co.part_name, v_qty, v_price, v_rate, v_taxable, v_tax, v_taxable + v_tax);

    v_sub := v_sub + v_taxable;
    v_taxsum := v_taxsum + v_tax;
  end loop;

  update public.invoices set subtotal = v_sub, tax_total = v_taxsum, total = v_sub + v_taxsum
   where id = inv.id returning * into inv;
  return inv;
end $$;

revoke all on function public.create_invoice from public;
grant execute on function public.create_invoice to authenticated;
