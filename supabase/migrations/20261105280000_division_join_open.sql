-- A division's Heads can close join requests (when the division is full): divisions.join_open, on by default. Additive, nothing existing changes. Safe to run once.
alter table public.divisions add column if not exists join_open boolean not null default true;
