-- Club documentation gets the same two lists as division docs: who can read and who can edit, each a list of entries (a role, a team, a person (optionally until a day), a division's Heads, Members or Alumni).
-- A doc with no lists (null) keeps the old rule (read by everyone with the docs permission, edited by those who manage docs), so nothing existing changes until someone shares a doc differently.
-- Also: a log of who changed a doc's sharing, and requests for access. Safe to run more than once.
alter table public.docs add column if not exists read_access jsonb;
alter table public.docs add column if not exists edit_access jsonb;

create table if not exists public.doc_access_log (
  id       uuid primary key default gen_random_uuid(),
  doc_id   uuid not null references public.docs(id) on delete cascade,
  at       timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  summary  text not null,
  before   jsonb,
  after    jsonb
);
create index if not exists doc_access_log_doc_idx on public.doc_access_log (doc_id, at desc);
alter table public.doc_access_log enable row level security;

create table if not exists public.doc_access_requests (
  id          uuid primary key default gen_random_uuid(),
  doc_id      uuid not null references public.docs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  message     text not null default '',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz
);
create unique index if not exists doc_access_requests_one_pending on public.doc_access_requests (doc_id, user_id) where status = 'pending';
alter table public.doc_access_requests enable row level security;

-- Does this list let this person in? (the same rules as lib/docs/access.ts)
create or replace function public.doc_entries_match(entries jsonb, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(entries, '[]'::jsonb)) e
    where case e ->> 't'
      when 'everyone'  then true
      when 'signed_in' then uid is not null
      when 'role'      then exists (select 1 from public.user_roles r where r.user_id = uid and r.role::text = e ->> 'role')
      when 'team'      then exists (select 1 from public.meeting_groups g where g.id::text = e ->> 'id' and uid = any (g.member_ids))
      when 'person'    then e ->> 'id' = uid::text and (e ->> 'until' is null or now() <= ((e ->> 'until') || 'T23:59:59-08:00')::timestamptz)
      when 'division'  then exists (select 1 from public.user_roles r where r.user_id = uid and r.role::text = e ->> 'role' and (e ->> 'division_id' is null or r.division_id::text = e ->> 'division_id'))
      else false end
  );
$$;

-- May the signed-in person read or edit this doc? Exec and admin always; a doc with no lists keeps the old permission rule; whoever may edit may also read.
create or replace function public.doc_can(doc uuid, mode text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); r jsonb; e jsonb;
begin
  if uid is null then return false; end if;
  select read_access, edit_access into r, e from public.docs where id = doc;
  if not found then return false; end if;
  if exists (select 1 from public.user_roles x where x.user_id = uid and x.role::text in ('exec', 'admin')) then return true; end if;
  if mode = 'read' then
    if r is null then return public.has_capability('view_docs'); end if;
    return public.doc_entries_match(r, uid) or public.doc_entries_match(e, uid);
  end if;
  if e is null then return public.has_capability('manage_docs'); end if;
  return public.doc_entries_match(e, uid);
end $$;

drop policy if exists "view_docs can read" on public.docs;
create policy "docs read by access" on public.docs for select using (public.doc_can(id, 'read'));
drop policy if exists "manage_docs can update" on public.docs;
create policy "docs edit by access" on public.docs for update using (public.doc_can(id, 'edit'));
drop policy if exists "manage_docs can delete" on public.docs;
create policy "docs delete by access" on public.docs for delete using (public.doc_can(id, 'edit'));
