-- Chuka Comrades: paid roommate posting (KSh 100 per semester, activated by the admin).
-- Run once in the Supabase SQL Editor AFTER 202611140001_roommates.sql.
--
-- How it works
--  * The admin activates a student's email (after the M-Pesa payment) with an expiry date
--    (the semester end). Stored in roommate_passes, which students can never read or write.
--  * A student can only INSERT a post while their (verified) email has an active pass. This is
--    enforced by the database trigger below, so it cannot be bypassed from the browser.
--  * A post stops showing in the browse list when its pass expires, and shows again when the
--    admin renews the pass.
--  * Posts created before this migration have no owner email, so they stay visible (grandfathered).
--    To end them with the semester, run once:
--      update public.roommate_posts set pass_expires_at = '2026-12-31T23:59:59+03:00' where pass_expires_at is null;

create table if not exists public.roommate_passes (
  email       text primary key,
  expires_at  timestamptz not null,
  mpesa_code  text not null default '',
  granted_at  timestamptz not null default now(),
  granted_by  text not null default ''
);
alter table public.roommate_passes enable row level security; -- no policies: only the functions below can touch it

alter table public.roommate_posts add column if not exists owner_email text;
alter table public.roommate_posts add column if not exists pass_expires_at timestamptz;

-- Expiry of the CURRENT user's active pass (null when they have none).
create or replace function public.roommate_pass_expiry()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select p.expires_at
  from public.roommate_passes p
  where p.email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and coalesce((auth.jwt() ->> 'email_verified')::boolean, false)
    and p.expires_at > now()
$$;

-- ---------- guard: now also checks the pass ----------
create or replace function public.roommate_posts_guard()
returns trigger
language plpgsql
as $$
declare exp timestamptz;
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'pending'; new.reject_reason := null;
      exp := public.roommate_pass_expiry();
      if exp is null then
        raise exception 'Posting costs a small semester fee. Pay the admin on WhatsApp and wait for activation, then try again.';
      end if;
      new.pass_expires_at := exp;
      new.owner_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    end if;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;

  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if not public.is_admin() then
    new.owner_email := old.owner_email;
    exp := public.roommate_pass_expiry();
    new.pass_expires_at := coalesce(exp, old.pass_expires_at);  -- a renewed pass revives the post
    if (new.first_name, new.gender, new.course, new.year_of_study, new.budget_min, new.budget_max,
        new.room_type, new.area, new.has_room, new.hostel_name, new.lifestyle, new.bio)
       is distinct from
       (old.first_name, old.gender, old.course, old.year_of_study, old.budget_min, old.budget_max,
        old.room_type, old.area, old.has_room, old.hostel_name, old.lifestyle, old.bio) then
      new.status := 'pending';           -- edited content must be approved again
      new.reject_reason := null;
    else
      new.status := old.status;          -- hiding/showing never changes approval
      new.reject_reason := old.reject_reason;
    end if;
  end if;
  return new;
end
$$;

-- ---------- browse: hide posts whose pass has ended ----------
create or replace function public.roommate_browse(p_gender text)
returns table (
  id uuid, first_name text, gender text, course text, year_of_study int, budget_min int, budget_max int,
  room_type text, area text, has_room boolean, hostel_name text, lifestyle jsonb, bio text,
  updated_at timestamptz, interested boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_gender not in ('male', 'female') then raise exception 'Choose your gender first.'; end if;
  return query
    select p.id, p.first_name, p.gender, p.course, p.year_of_study, p.budget_min, p.budget_max,
           p.room_type, p.area, p.has_room, p.hostel_name, p.lifestyle, p.bio, p.updated_at,
           exists (select 1 from public.roommate_interests i where i.post_id = p.id and i.from_user = uid)
    from public.roommate_posts p
    where p.status = 'approved' and not p.hidden and p.gender = p_gender and p.user_id <> uid
      and (p.pass_expires_at is null or p.pass_expires_at > now())
    order by p.updated_at desc
    limit 200;
end
$$;

-- ---------- student: do I have an active pass? ----------
create or replace function public.roommate_my_pass()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select public.roommate_pass_expiry()
$$;

-- ---------- admin only ----------
create or replace function public.roommate_pass_list()
returns table (email text, expires_at timestamptz, mpesa_code text, granted_at timestamptz, granted_by text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  return query
    select p.email, p.expires_at, p.mpesa_code, p.granted_at, p.granted_by
    from public.roommate_passes p order by p.granted_at desc limit 500;
end
$$;

create or replace function public.roommate_pass_grant(p_email text, p_code text, p_expires timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Enter a valid email address.'; end if;
  if p_expires is null or p_expires <= now() then raise exception 'The expiry date must be in the future.'; end if;
  insert into public.roommate_passes (email, expires_at, mpesa_code, granted_at, granted_by)
  values (e, p_expires, left(upper(trim(coalesce(p_code, ''))), 30), now(), lower(coalesce(auth.jwt() ->> 'email', '')))
  on conflict (email) do update
    set expires_at = excluded.expires_at, mpesa_code = excluded.mpesa_code,
        granted_at = now(), granted_by = excluded.granted_by;
  update public.roommate_posts set pass_expires_at = p_expires where owner_email = e;  -- revive an expired post
end
$$;

create or replace function public.roommate_pass_revoke(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare e text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Admin only.'; end if;
  delete from public.roommate_passes where email = e;
  update public.roommate_posts set pass_expires_at = now() where owner_email = e;
end
$$;

-- ---------- permissions ----------
revoke all on function public.roommate_pass_expiry() from public;
revoke all on function public.roommate_my_pass() from public;
revoke all on function public.roommate_pass_list() from public;
revoke all on function public.roommate_pass_grant(text, text, timestamptz) from public;
revoke all on function public.roommate_pass_revoke(text) from public;
grant execute on function public.roommate_pass_expiry() to anon, authenticated;
grant execute on function public.roommate_my_pass() to anon, authenticated;
grant execute on function public.roommate_pass_list() to anon, authenticated;
grant execute on function public.roommate_pass_grant(text, text, timestamptz) to anon, authenticated;
grant execute on function public.roommate_pass_revoke(text) to anon, authenticated;

notify pgrst, 'reload schema';
