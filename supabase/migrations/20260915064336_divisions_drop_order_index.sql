-- Divisions are simply sorted alphabetically by name everywhere now — no
-- manual ordering concept needed.
alter table public.divisions drop column if exists order_index;
