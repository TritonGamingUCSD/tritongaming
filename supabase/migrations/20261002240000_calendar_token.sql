-- A private token per person for their calendar subscription link (Google/Apple Calendar). The link shows only what
-- that person can already see in the portal Calendar; resetting the token kills the old link.
alter table public.profiles add column if not exists calendar_token uuid not null default gen_random_uuid();
create unique index if not exists profiles_calendar_token_idx on public.profiles (calendar_token);
