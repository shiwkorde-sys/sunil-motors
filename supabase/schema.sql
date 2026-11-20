-- Sunil Motors Garage — Supabase schema
-- Paste this whole file into Supabase > SQL Editor > Run.

create extension if not exists pgcrypto;

-- ───────────── Profiles & roles ─────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- The FIRST person to sign up becomes admin; everyone after is staff.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when not exists (select 1 from public.profiles) then 'admin' else 'staff' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ───────────── Parts ─────────────
create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  company text,
  category text,
  description text,
  dimension text,
  compatible_models text[] not null default '{}',
  shelf_location text,
  quantity_available integer not null default 0 check (quantity_available >= 0),
  min_stock integer not null default 2 check (min_stock >= 0),
  price numeric(10,2),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists parts_models_gin on public.parts using gin (compatible_models);
create index if not exists parts_name_idx on public.parts (lower(name));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists parts_touch on public.parts;
create trigger parts_touch before update on public.parts
  for each row execute function public.touch_updated_at();

-- ───────────── Checkout audit log (append-only) ─────────────
create table if not exists public.checkout_transactions (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id),
  sku text not null,
  part_name text not null,
  quantity integer not null check (quantity > 0),
  mechanic_name text not null check (length(trim(mechanic_name)) > 0),
  vehicle_registration text,
  job_reference text,
  checked_out_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.block_tx_changes()
returns trigger language plpgsql as $$
begin raise exception 'checkout_transactions is append-only'; end $$;

drop trigger if exists tx_no_update on public.checkout_transactions;
create trigger tx_no_update before update or delete on public.checkout_transactions
  for each row execute function public.block_tx_changes();

-- ───────────── Row-level security ─────────────
alter table public.profiles enable row level security;
alter table public.parts enable row level security;
alter table public.checkout_transactions enable row level security;

-- Everyone signed in can read.
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "read parts"    on public.parts    for select to authenticated using (true);
create policy "read checkouts" on public.checkout_transactions for select to authenticated using (true);

-- Only admins change parts and roles.
create policy "admin insert parts" on public.parts for insert to authenticated with check (public.is_admin());
create policy "admin update parts" on public.parts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete parts" on public.parts for delete to authenticated using (public.is_admin());
create policy "admin update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Checkout logs can ONLY be created through checkout_part() below (atomic with stock change),
-- so there is deliberately no direct INSERT policy.

-- ───────────── Atomic checkout ─────────────
create or replace function public.checkout_part(
  p_part_id uuid,
  p_quantity integer,
  p_mechanic_name text default null,          -- ignored when the account has a name
  p_vehicle_registration text default null,
  p_job_reference text default null
) returns public.checkout_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_part public.parts;
  v_tx public.checkout_transactions;
  v_name text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;

  -- The log records WHO is signed in, so a name can never be typed in or faked.
  select coalesce(nullif(trim(full_name), ''), nullif(split_part(email, '@', 1), ''))
    into v_name from public.profiles where id = auth.uid();
  v_name := coalesce(v_name, nullif(trim(coalesce(p_mechanic_name, '')), ''));
  if v_name is null then raise exception 'Your account has no name. Ask the owner to add it.'; end if;

  select * into v_part from public.parts where id = p_part_id for update;  -- row lock
  if not found then raise exception 'Part not found'; end if;
  if v_part.quantity_available < p_quantity then
    raise exception 'Only % in stock', v_part.quantity_available;
  end if;

  update public.parts set quantity_available = quantity_available - p_quantity where id = p_part_id;

  insert into public.checkout_transactions
    (part_id, sku, part_name, quantity, mechanic_name, vehicle_registration, job_reference)
  values
    (v_part.id, v_part.sku, v_part.name, p_quantity, v_name,
     nullif(upper(trim(coalesce(p_vehicle_registration, ''))), ''), nullif(trim(coalesce(p_job_reference, '')), ''))
  returning * into v_tx;

  return v_tx;
end $$;

revoke all on function public.checkout_part from public;
grant execute on function public.checkout_part to authenticated;

-- ───────────── In-stock alternatives (matching compatible_models) ─────────────
create or replace function public.find_alternatives(p_part_id uuid)
returns setof public.parts
language sql stable security invoker set search_path = public as $$
  with src as (
    select id, category, (select coalesce(array_agg(lower(trim(m))), '{}') from unnest(compatible_models) m) as models
    from public.parts where id = p_part_id
  )
  select p.* from public.parts p, src
  where p.id <> src.id
    and p.quantity_available > 0
    and p.category is not distinct from src.category   -- same kind of part
    and (select coalesce(array_agg(lower(trim(m))), '{}') from unnest(p.compatible_models) m) && src.models
  order by (p.category is not distinct from src.category) desc, p.quantity_available desc
  limit 12;
$$;

grant execute on function public.find_alternatives to authenticated;

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
