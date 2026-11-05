-- A division's accent color: the key of one color in the fixed palette (src/lib/divisions/accent.ts). Empty means the Triton Gaming yellow.
-- Additive. Safe to run once.
alter table public.divisions add column if not exists accent text;
