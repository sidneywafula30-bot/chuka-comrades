-- Chuka Comrades: one subscription unlocks hostels AND roommate posting.
-- Run once in the Supabase SQL Editor AFTER 202611160001_roommate_passes.sql.
--
-- Why this exists
--  * When an admin approves a payment in WhatsApp, the hostel Apps Script writes the student's
--    subscription expiry into public.roommate_passes using the Supabase SERVICE ROLE key
--    (script properties SUPABASE_URL and SUPABASE_SERVICE_KEY). The service key never goes to the browser.
--  * The posts guard trigger below is the same as before, with ONE addition: requests made with the
--    service role (the Apps Script) skip the student rules, so it can revive a student's hidden post when
--    they renew. Everything a student's browser does is checked exactly as before.

create or replace function public.roommate_posts_guard()
returns trigger
language plpgsql
as $$
declare exp timestamptz;
begin
  -- Trusted server call (service role): used by the subscription sync to extend or end a pass.
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    if tg_op = 'INSERT' then
      new.created_at := now(); new.updated_at := now();
    else
      new.user_id := old.user_id;
      new.created_at := old.created_at;
      new.updated_at := old.updated_at;   -- a renewal must not bump the post to the top of the list
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'pending'; new.reject_reason := null;
      exp := public.roommate_pass_expiry();
      if exp is null then
        raise exception 'Posting is part of the Chuka Hostel subscription. Subscribe on WhatsApp and wait for activation, then try again.';
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

notify pgrst, 'reload schema';
