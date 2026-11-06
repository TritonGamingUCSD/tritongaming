-- Broadcast for divisions: a broadcast belongs to the club (division_id empty) or to one division, with its own schedule, roles (its broadcast team) and checklist. A division's Twitch and YouTube channels are kept in team_settings as broadcast_twitch:<division id> and broadcast_youtube:<division id>.
-- Additive. Safe to run more than once.
alter table public.broadcasts add column if not exists division_id uuid references public.divisions(id) on delete cascade;
create index if not exists broadcasts_division_idx on public.broadcasts (division_id, starts_at desc);
