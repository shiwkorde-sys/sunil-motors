-- Run once in Supabase > SQL Editor on the LIVE database.
-- Checkout now records the signed-in account's name. Safe: only replaces one function; no data is touched.

drop function if exists public.checkout_part(uuid, integer, text, text, text);

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

revoke all on function public.checkout_part(uuid, integer, text, text, text) from public;
grant execute on function public.checkout_part(uuid, integer, text, text, text) to authenticated;
