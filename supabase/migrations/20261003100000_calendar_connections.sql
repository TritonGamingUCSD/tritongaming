-- A member's optional, view-only link to their own Google Calendar. Signing in with Google does NOT create one of these: this is a
-- separate consent. Only the refresh token is kept (encrypted by the app, never readable from the browser), so there is no policy:
-- the table is reached only through the server's service role.
create table if not exists public.calendar_connections (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  provider       text not null default 'google' check (provider = 'google'),
  google_email   text,
  refresh_token_enc text not null,
  scope          text,
  show_titles    boolean not null default true,
  connected_at   timestamptz not null default now(),
  last_ok_at     timestamptz,
  last_error     text
);
alter table public.calendar_connections enable row level security;
