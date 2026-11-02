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
  p_mechanic_name text,
  p_vehicle_registration text default null,
  p_job_reference text default null
) returns public.checkout_transactions
language plpgsql security definer set search_path = public as $$
declare
  v_part public.parts;
  v_tx public.checkout_transactions;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Quantity must be at least 1'; end if;
  if length(trim(coalesce(p_mechanic_name, ''))) = 0 then raise exception 'Mechanic name is required'; end if;

  select * into v_part from public.parts where id = p_part_id for update;  -- row lock
  if not found then raise exception 'Part not found'; end if;
  if v_part.quantity_available < p_quantity then
    raise exception 'Only % in stock', v_part.quantity_available;
  end if;

  update public.parts set quantity_available = quantity_available - p_quantity where id = p_part_id;

  insert into public.checkout_transactions
    (part_id, sku, part_name, quantity, mechanic_name, vehicle_registration, job_reference)
  values
    (v_part.id, v_part.sku, v_part.name, p_quantity, trim(p_mechanic_name),
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
