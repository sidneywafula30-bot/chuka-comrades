-- Chuka Comrades: roommate finder (admin-approved posts, mutual-interest contact sharing).
-- Run this once in the Supabase SQL Editor (after 202611130001_profiles.sql).
--
-- Privacy design:
--  * Phone numbers live in their own table and are NEVER returned to other students
--    until BOTH sides agree (poster accepts an interest request).
--  * Students cannot read the posts table directly. They browse through roommate_browse(),
--    which needs a signed-in user, only returns APPROVED + visible posts, and only the
--    same gender as the browser.
--  * Only the admin (verified email in app_admins) can approve / reject. Editing an
--    approved post sends it back to "pending" automatically (trigger below).

-- ---------- needed by every policy below (same as in the profiles migration, safe to run again) ----------
create or replace function public.requesting_uid()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- ---------- admin helper ----------
create table if not exists public.app_admins (email text primary key);
alter table public.app_admins enable row level security; -- no policies: only the functions below can read it
insert into public.app_admins (email) values ('sidneywafula30@gmail.com') on conflict do nothing;
-- To add another admin:  insert into public.app_admins (email) values ('someone@gmail.com');

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

-- ---------- posts ----------
create table if not exists public.roommate_posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null unique,                       -- Firebase UID, one post per student
  first_name     text not null check (char_length(first_name) between 1 and 30),
  gender         text not null check (gender in ('male', 'female')),
  course         text not null check (char_length(course) between 1 and 60),
  year_of_study  int  not null check (year_of_study between 1 and 6),
  budget_min     int  not null check (budget_min between 0 and 1000000),
  budget_max     int  not null check (budget_max between 0 and 1000000),
  room_type      text not null default '' check (char_length(room_type) <= 40),
  area           text not null check (char_length(area) between 1 and 80),
  has_room       boolean not null default false,
  hostel_name    text not null default '' check (char_length(hostel_name) <= 120),
  lifestyle      jsonb not null default '{}'::jsonb,
  bio            text not null default '' check (char_length(bio) <= 400),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason  text,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (budget_min <= budget_max),
  check (not has_room or char_length(hostel_name) > 0)
);
create index if not exists roommate_posts_browse_idx on public.roommate_posts (status, gender, updated_at desc);

-- Private phone numbers (separate table so they can never leak through the posts policies).
create table if not exists public.roommate_contacts (
  post_id   uuid primary key references public.roommate_posts (id) on delete cascade,
  user_id   text not null,
  whatsapp  text not null check (whatsapp ~ '^254[17][0-9]{8}$')
);

-- "I'm interested" requests. No direct access at all: everything goes through the functions below.
create table if not exists public.roommate_interests (
  id             uuid primary key default gen_random_uuid(),
  post_id        uuid not null references public.roommate_posts (id) on delete cascade,
  from_user      text not null,
  from_name      text not null check (char_length(from_name) between 1 and 30),
  from_whatsapp  text not null check (from_whatsapp ~ '^254[17][0-9]{8}$'),
  note           text not null default '' check (char_length(note) <= 200),
  status         text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at     timestamptz not null default now(),
  unique (post_id, from_user)
);

create table if not exists public.roommate_reports (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.roommate_posts (id) on delete cascade,
  reporter    text not null,
  reason      text not null check (char_length(reason) between 3 and 300),
  created_at  timestamptz not null default now(),
  unique (post_id, reporter)
);

alter table public.roommate_posts     enable row level security;
alter table public.roommate_contacts  enable row level security;
alter table public.roommate_interests enable row level security;
alter table public.roommate_reports   enable row level security;

-- ---------- guard: students can never approve themselves ----------
create or replace function public.roommate_posts_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.status := 'pending'; new.reject_reason := null; end if;
    new.created_at := now(); new.updated_at := now();
    return new;
  end if;

  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  if not public.is_admin() then
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

drop trigger if exists roommate_posts_guard_trg on public.roommate_posts;
create trigger roommate_posts_guard_trg
  before insert or update on public.roommate_posts
  for each row execute function public.roommate_posts_guard();

-- ---------- policies ----------
drop policy if exists "rm_posts_select" on public.roommate_posts;
drop policy if exists "rm_posts_insert" on public.roommate_posts;
drop policy if exists "rm_posts_update" on public.roommate_posts;
drop policy if exists "rm_posts_delete" on public.roommate_posts;

create policy "rm_posts_select" on public.roommate_posts for select to anon, authenticated
  using (user_id = (select public.requesting_uid()) or (select public.is_admin()));
create policy "rm_posts_insert" on public.roommate_posts for insert to anon, authenticated
  with check (user_id = (select public.requesting_uid()));
create policy "rm_posts_update" on public.roommate_posts for update to anon, authenticated
  using (user_id = (select public.requesting_uid()) or (select public.is_admin()))
  with check (user_id = (select public.requesting_uid()) or (select public.is_admin()));
create policy "rm_posts_delete" on public.roommate_posts for delete to anon, authenticated
  using (user_id = (select public.requesting_uid()) or (select public.is_admin()));

drop policy if exists "rm_contacts_select" on public.roommate_contacts;
drop policy if exists "rm_contacts_insert" on public.roommate_contacts;
drop policy if exists "rm_contacts_update" on public.roommate_contacts;
drop policy if exists "rm_contacts_delete" on public.roommate_contacts;

create policy "rm_contacts_select" on public.roommate_contacts for select to anon, authenticated
  using (user_id = (select public.requesting_uid()) or (select public.is_admin()));
create policy "rm_contacts_insert" on public.roommate_contacts for insert to anon, authenticated
  with check (user_id = (select public.requesting_uid())
    and exists (select 1 from public.roommate_posts p where p.id = post_id and p.user_id = (select public.requesting_uid())));
create policy "rm_contacts_update" on public.roommate_contacts for update to anon, authenticated
  using (user_id = (select public.requesting_uid()))
  with check (user_id = (select public.requesting_uid())
    and exists (select 1 from public.roommate_posts p where p.id = post_id and p.user_id = (select public.requesting_uid())));
create policy "rm_contacts_delete" on public.roommate_contacts for delete to anon, authenticated
  using (user_id = (select public.requesting_uid()) or (select public.is_admin()));

drop policy if exists "rm_reports_admin" on public.roommate_reports;
create policy "rm_reports_admin" on public.roommate_reports for select to anon, authenticated
  using ((select public.is_admin()));
drop policy if exists "rm_reports_admin_delete" on public.roommate_reports;
create policy "rm_reports_admin_delete" on public.roommate_reports for delete to anon, authenticated
  using ((select public.is_admin()));
-- roommate_interests: intentionally no policies (deny all direct access).

-- ---------- functions students call ----------

-- Browse approved posts of the SAME gender. Requires sign-in. Never returns phone numbers.
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
    order by p.updated_at desc
    limit 200;
end
$$;

create or replace function public.roommate_express_interest(
  p_post_id uuid, p_name text, p_gender text, p_whatsapp text, p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.requesting_uid();
  target public.roommate_posts;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select * into target from public.roommate_posts
    where id = p_post_id and status = 'approved' and not hidden;
  if not found then raise exception 'That post is no longer available.'; end if;
  if target.user_id = uid then raise exception 'This is your own post.'; end if;
  if target.gender <> p_gender then raise exception 'You can only contact students of the same gender.'; end if;
  if (select count(*) from public.roommate_interests where from_user = uid and created_at > now() - interval '1 day') >= 15 then
    raise exception 'You have sent many requests today. Please try again tomorrow.';
  end if;
  begin
    insert into public.roommate_interests (post_id, from_user, from_name, from_whatsapp, note)
    values (p_post_id, uid, left(trim(p_name), 30), p_whatsapp, left(coalesce(trim(p_note), ''), 200));
  exception when unique_violation then
    raise exception 'You already showed interest in this post.';
  end;
end
$$;

-- Requests other students sent to MY post. The sender's number appears only after I accept.
create or replace function public.roommate_interests_received()
returns table (id uuid, post_id uuid, from_name text, note text, status text, created_at timestamptz, whatsapp text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  return query
    select i.id, i.post_id, i.from_name, i.note, i.status, i.created_at,
           case when i.status = 'accepted' then i.from_whatsapp else null end
    from public.roommate_interests i
    join public.roommate_posts p on p.id = i.post_id
    where p.user_id = uid
    order by i.created_at desc;
end
$$;

-- Requests I sent. The poster's number appears only after they accept.
create or replace function public.roommate_interests_sent()
returns table (id uuid, post_id uuid, first_name text, area text, status text, created_at timestamptz, whatsapp text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  return query
    select i.id, i.post_id, p.first_name, p.area, i.status, i.created_at,
           case when i.status = 'accepted' then c.whatsapp else null end
    from public.roommate_interests i
    join public.roommate_posts p on p.id = i.post_id
    left join public.roommate_contacts c on c.post_id = p.id
    where i.from_user = uid
    order by i.created_at desc;
end
$$;

create or replace function public.roommate_respond(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_accept and not exists (
    select 1 from public.roommate_interests i
    join public.roommate_posts p on p.id = i.post_id
    join public.roommate_contacts c on c.post_id = p.id
    where i.id = p_id and p.user_id = uid
  ) then
    raise exception 'Add your WhatsApp number to your post first.';
  end if;
  update public.roommate_interests i
     set status = case when p_accept then 'accepted' else 'declined' end
    from public.roommate_posts p
   where i.id = p_id and i.post_id = p.id and p.user_id = uid and i.status = 'pending';
  if not found then raise exception 'That request was already answered or no longer exists.'; end if;
end
$$;

create or replace function public.roommate_withdraw_interest(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  delete from public.roommate_interests where id = p_id and from_user = uid;
end
$$;

create or replace function public.roommate_report(p_post_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid text := public.requesting_uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Please say what is wrong (at least 3 characters).'; end if;
  insert into public.roommate_reports (post_id, reporter, reason)
  values (p_post_id, uid, left(trim(p_reason), 300))
  on conflict (post_id, reporter) do nothing;
end
$$;

-- ---------- execute permissions ----------
revoke all on function public.roommate_browse(text) from public;
revoke all on function public.roommate_express_interest(uuid, text, text, text, text) from public;
revoke all on function public.roommate_interests_received() from public;
revoke all on function public.roommate_interests_sent() from public;
revoke all on function public.roommate_respond(uuid, boolean) from public;
revoke all on function public.roommate_withdraw_interest(uuid) from public;
revoke all on function public.roommate_report(uuid, text) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.roommate_browse(text) to anon, authenticated;
grant execute on function public.roommate_express_interest(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.roommate_interests_received() to anon, authenticated;
grant execute on function public.roommate_interests_sent() to anon, authenticated;
grant execute on function public.roommate_respond(uuid, boolean) to anon, authenticated;
grant execute on function public.roommate_withdraw_interest(uuid) to anon, authenticated;
grant execute on function public.roommate_report(uuid, text) to anon, authenticated;

-- ---------- make the API see the new tables/functions right away ----------
notify pgrst, 'reload schema';
