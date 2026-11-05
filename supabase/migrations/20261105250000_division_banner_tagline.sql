-- A division's public page: a one-line tagline and a banner picture for its hero (both optional; empty keeps today's hero). Additive, nothing existing changes meaning. Safe to run once.
alter table public.divisions add column if not exists tagline text;
alter table public.divisions add column if not exists banner_url text;
