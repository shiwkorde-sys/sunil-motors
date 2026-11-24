-- Let an admin remove a worker's login. Safe to run more than once.
-- Sales and bills keep working: they store the worker's NAME as text, not a link to the account.
create or replace function public.delete_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_role text;
begin
  if not public.is_admin() then raise exception 'Only admins can remove accounts'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot remove your own account'; end if;

  select role into v_role from public.profiles where id = p_user_id;
  if v_role is null then raise exception 'Account not found'; end if;
  if v_role = 'admin' then raise exception 'Change this person to Staff first, then remove the account'; end if;

  delete from auth.users where id = p_user_id;   -- their profile is removed with it (on delete cascade)
end $$;

revoke all on function public.delete_user(uuid) from public;
revoke all on function public.delete_user(uuid) from anon;
grant execute on function public.delete_user(uuid) to authenticated;
