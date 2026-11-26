-- In-app feedback: staff send a rating and note; only admins can read them. Safe to run more than once.
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  user_name text,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  page text
);
alter table public.app_feedback enable row level security;
drop policy if exists "send feedback" on public.app_feedback;
drop policy if exists "admin read feedback" on public.app_feedback;
create policy "send feedback" on public.app_feedback for insert to authenticated with check (user_id = auth.uid());
create policy "admin read feedback" on public.app_feedback for select to authenticated using (public.is_admin());
