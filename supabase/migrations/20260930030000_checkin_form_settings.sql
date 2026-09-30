-- The UCSD check-in form config (same Google Form all year — see
-- getTicketsData.ts/buildCheckinFormUrl) belongs with event management, not
-- site content: it's operational config for the check-in flow, read by
-- manage_events holders, not public-facing copy someone with
-- manage_site_content (a different capability, possibly a different
-- person) would touch. A dedicated singleton table rather than a
-- site_contents row, so it never shows up in the generic Site Content
-- editor at all.
create table public.checkin_form_settings (
  id smallint primary key default 1 check (id = 1),
  form_url text,
  entry_event_name text,
  entry_academic_year text,
  entry_affiliation text,
  entry_food_item text,
  year_mapping jsonb not null default '[]',
  affiliation_mapping jsonb not null default '[]',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.checkin_form_settings (id) values (1);

alter table public.checkin_form_settings enable row level security;

-- Readable by any signed-in user — this is what builds *their own* prefill
-- URL on the tickets page (see getTicketsData.ts), so it can't be gated to
-- manage_events without breaking check-in for everyone else. Nothing in it
-- is sensitive (a form URL, entry IDs, and generic label mappings).
create policy "checkin form settings readable by any signed-in user"
  on public.checkin_form_settings for select
  using (auth.uid() is not null);

create policy "checkin form settings manageable by manage_events"
  on public.checkin_form_settings for update
  using (has_capability('manage_events'))
  with check (has_capability('manage_events'));
