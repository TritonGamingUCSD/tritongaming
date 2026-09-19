-- Audit trail for role changes. admin_set_user_roles does a full
-- delete+reinsert of a user's role rows on every save (see
-- 20260915033819_multi_role_capabilities.sql) — nothing kept a record of
-- what changed, so "who gave this person admin, and when" was only
-- answerable by digging through Supabase's own dashboard logs, if at all.

begin;

create table public.role_change_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  changed_by  uuid references public.profiles(id),
  before      jsonb not null,
  after       jsonb not null,
  created_at  timestamptz not null default now()
);

create index role_change_log_user_id_idx on public.role_change_log (user_id);
create index role_change_log_created_at_idx on public.role_change_log (created_at desc);

alter table public.role_change_log enable row level security;

-- Same gate as the RPC that writes it — only admins should be able to read
-- who-changed-what.
create policy "role_change_log readable by admins"
  on public.role_change_log for select
  using (has_capability('manage_roles'));

-- Snapshots the user's role set before and after the swap, in the same
-- transaction as the swap itself, so the log can never drift out of sync
-- with what admin_set_user_roles actually did.
create or replace function public.admin_set_user_roles(_user_id uuid, _roles jsonb, _granted_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _before jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('role', role, 'division_id', division_id)), '[]'::jsonb)
    into _before
    from public.user_roles where user_id = _user_id;

  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role, division_id, granted_by)
  select _user_id, (r->>'role')::app_role, nullif(r->>'division_id', '')::uuid, _granted_by
  from jsonb_array_elements(_roles) as r;

  insert into public.role_change_log (user_id, changed_by, before, after)
  values (_user_id, _granted_by, _before, coalesce(_roles, '[]'::jsonb));
end;
$$;

commit;
