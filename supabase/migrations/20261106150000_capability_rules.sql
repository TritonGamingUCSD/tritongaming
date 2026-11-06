-- Access rules, not just grants: a rule can GIVE a permission to a person or group, or DENY one they would get from their role; it can end on a date; it can carry a note saying why.
-- Existing grants stay as they are (effect 'grant', no end date). Safe to run once.
alter table public.capability_grants add column if not exists effect text not null default 'grant' check (effect in ('grant', 'deny'));
alter table public.capability_grants add column if not exists expires_at timestamptz;
alter table public.capability_grants add column if not exists note text not null default '';
create index if not exists capability_grants_expires_idx on public.capability_grants (expires_at) where expires_at is not null;
