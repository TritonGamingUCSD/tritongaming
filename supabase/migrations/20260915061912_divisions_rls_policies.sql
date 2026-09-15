-- `divisions` has row level security ENABLED but had zero policies — the
-- Postgres default for that combination is deny-all to every non-privileged
-- role, confirmed live: a real authenticated session saw 0 of the 10 real
-- rows. This silently broke the Role Manager's division picker and the
-- manage_division capability check on /divisions/[slug] (the division-row
-- lookup there always returned null, so canEdit was always false for
-- everyone, including admins) — nobody had exercised either path yet.
--
-- Reads are public (division names aren't sensitive and already surface
-- on the public marketing page); writes are admin-only, enforced here via
-- RLS directly (not a service-role API route) since an admin editing this
-- table is authoring their own writes, not acting on someone else's data.

create policy "divisions are publicly readable" on public.divisions
  for select using (true);

create policy "admins insert divisions" on public.divisions
  for insert with check (has_capability('manage_roles'));

create policy "admins update divisions" on public.divisions
  for update using (has_capability('manage_roles')) with check (has_capability('manage_roles'));

create policy "admins delete divisions" on public.divisions
  for delete using (has_capability('manage_roles'));
