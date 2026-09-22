-- Admin-only verification fields: the member's name exactly as Google
-- reports it, split into first/last, kept separate from the user-editable
-- profiles.display_name (which can be changed to a nickname/gamer alias
-- at will). Never exposed to any edit form — only written by
-- handle_new_user (at signup) and the auth callback route's sync on every
-- subsequent sign-in (same pattern as the 'ucsd' role re-check there),
-- both using the service-role client / security-definer path, never a
-- user-writable RPC.
--
-- Google's OAuth payload in this project only ever provides a single
-- combined full_name/name string, not separate given_name/family_name
-- fields (confirmed against live raw_user_meta_data) — so first/last is
-- derived by splitting on the first space. A one-word name lands entirely
-- in google_first_name with google_last_name left null.

begin;

alter table public.profiles
  add column google_first_name text,
  add column google_last_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  _full_name text;
begin
  _full_name := trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));

  insert into public.profiles (id, display_name, avatar_url, referral_code, google_first_name, google_last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    upper(substr(replace(new.id::text, '-', ''), 1, 8)),
    nullif(split_part(_full_name, ' ', 1), ''),
    nullif(trim(substring(_full_name from length(split_part(_full_name, ' ', 1)) + 1)), '')
  )
  on conflict (id) do nothing;

  if new.email ilike '%@ucsd.edu' then
    insert into public.user_roles (user_id, role) values (new.id, 'ucsd') on conflict do nothing;
  end if;

  return new;
end;
$$;

-- Called from the auth callback route on every sign-in/link (same spot as
-- the 'ucsd' role re-check), passing whichever identity's full_name Supabase
-- surfaced for that session — keeps this in sync with Google without
-- duplicating the split logic in application code.
create or replace function public.sync_google_name(_user_id uuid, _full_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text := trim(_full_name);
begin
  if _name is null or _name = '' then
    return;
  end if;
  update public.profiles
  set
    google_first_name = nullif(split_part(_name, ' ', 1), ''),
    google_last_name = nullif(trim(substring(_name from length(split_part(_name, ' ', 1)) + 1)), '')
  where id = _user_id;
end;
$$;

revoke all on function public.sync_google_name(uuid, text) from public, anon, authenticated;

-- One-time backfill for every profile that already existed before these
-- columns did.
update public.profiles p
set
  google_first_name = nullif(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ' ', 1), ''),
  google_last_name = nullif(trim(substring(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')) from length(split_part(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ' ', 1)) + 1)), '')
from auth.users u
where u.id = p.id;

commit;
