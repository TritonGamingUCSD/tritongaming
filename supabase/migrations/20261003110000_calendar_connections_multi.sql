-- A member can link more than one Google account (e.g. a school and a personal one). One row per linked account.
alter table public.calendar_connections drop constraint calendar_connections_pkey;
alter table public.calendar_connections add column id uuid not null default gen_random_uuid();
alter table public.calendar_connections add primary key (id);
alter table public.calendar_connections alter column google_email set not null;
create unique index calendar_connections_user_account on public.calendar_connections (user_id, lower(google_email));
create index calendar_connections_user on public.calendar_connections (user_id);
