-- Chuka Comrades: WhatsApp group links shown on the landing page.
-- Run once in the Supabase SQL Editor. Safe to run again.
--  * Everyone (even signed out) can READ active groups.
--  * Only an admin (VERIFIED email listed in app_admins) can add, hide, show or delete groups.

-- ---------- admin helper (same as the roommates migration; harmless to repeat) ----------
create table if not exists public.app_admins (email text primary key);
alter table public.app_admins enable row level security;
insert into public.app_admins (email) values ('sidneywafula30@gmail.com') on conflict do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email_verified')::boolean, false)
     and exists (select 1 from public.app_admins a where a.email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- table ----------
create table if not exists public.whatsapp_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 160),
  link        text not null check (link ~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{10,}(\?[^[:space:]]*)?$'),
  sort        int  not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.whatsapp_groups enable row level security;

drop policy if exists "wg_select" on public.whatsapp_groups;
drop policy if exists "wg_insert" on public.whatsapp_groups;
drop policy if exists "wg_update" on public.whatsapp_groups;
drop policy if exists "wg_delete" on public.whatsapp_groups;
-- Tokens arrive as the anon role (see README), so policies target anon + authenticated and rely on is_admin().
create policy "wg_select" on public.whatsapp_groups for select to anon, authenticated using (active or (select public.is_admin()));
create policy "wg_insert" on public.whatsapp_groups for insert to anon, authenticated with check ((select public.is_admin()));
create policy "wg_update" on public.whatsapp_groups for update to anon, authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "wg_delete" on public.whatsapp_groups for delete to anon, authenticated using ((select public.is_admin()));
grant select, insert, update, delete on public.whatsapp_groups to anon, authenticated;

-- ---------- starting groups (the two hostel groups already used in the app) ----------
insert into public.whatsapp_groups (name, description, link, sort)
select * from (values
  ('Hostels: students',  'Find hostels, rooms and roommates.',        'https://chat.whatsapp.com/BhLqKOxHjigHF3oH6fyuFM', 10),
  ('Hostels: landlords', 'For landlords and hostel managers.',        'https://chat.whatsapp.com/FDizebVp5qP0yr91lnNduG', 20)
) as v(name, description, link, sort)
where not exists (select 1 from public.whatsapp_groups);
