-- Station guides: each station doubles as the master doc for that job. A color category (general, or aimed at one team: only a warning when someone
-- outside the team signs up), where it is, what to do, and a link to a script or portal doc. Everyone who can see shifts can read all of it.
alter table public.shift_stations
  add column if not exists category text not null default 'general' check (category in ('general', 'team')),
  add column if not exists team_label text check (team_label is null or char_length(team_label) <= 40),
  add column if not exists location text check (location is null or char_length(location) <= 120),
  add column if not exists instructions text check (instructions is null or char_length(instructions) <= 4000),
  add column if not exists doc_id uuid references public.docs(id) on delete set null,
  add column if not exists link_url text check (link_url is null or char_length(link_url) <= 500),
  add column if not exists link_label text check (link_label is null or char_length(link_label) <= 60);

-- Set when the person taps "I'm here" for the shift.
alter table public.shift_signups add column if not exists arrived_at timestamptz;
