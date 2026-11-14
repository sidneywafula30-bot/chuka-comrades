-- Chuka Comrades: profiles table, secured for Firebase users (free-tier setup).
--
-- Firebase tokens have no `role: authenticated` claim unless you pay for Firebase
-- blocking functions, so Supabase runs these requests as the `anon` role.
-- That is fine: every policy below checks the verified Firebase user id
-- (the JWT `sub` claim). A request with no valid token has no `sub`, so it is denied.

create or replace function public.requesting_uid()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

create table if not exists public.profiles (
  id            text primary key,              -- Firebase UID
  email         text,
  display_name  text,
  photo_url     text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to anon, authenticated
  using (id = (select public.requesting_uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to anon, authenticated
  with check (id = (select public.requesting_uid()));

create policy "profiles_update_own" on public.profiles
  for update to anon, authenticated
  using (id = (select public.requesting_uid()))
  with check (id = (select public.requesting_uid()));
