-- Three new profile fields: `college` becomes required (alongside the
-- existing display_name/major/year gate before someone can get a ticket —
-- see src/lib/profile.ts), `pronouns` and `birthday` stay optional.

alter table public.profiles
  add column if not exists college text,
  add column if not exists pronouns text,
  add column if not exists birthday date;
