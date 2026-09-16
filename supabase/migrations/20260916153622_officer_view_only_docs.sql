-- Officers could create/edit/delete docs (manage_docs also gated reading,
-- unlike events) — they should only be able to view them. manage_docs
-- narrows to lead/exec/admin for insert/update/delete; the new view_docs
-- capability (officer/lead/exec/admin) takes over the read policies so
-- officers keep read access instead of losing the section entirely.
delete from public.role_capabilities where role = 'officer' and capability = 'manage_docs';
insert into public.role_capabilities (role, capability) values
  ('officer', 'view_docs'),
  ('lead',    'view_docs'),
  ('exec',    'view_docs')
on conflict do nothing;

drop policy if exists "manage_docs can read" on public.docs;
create policy "view_docs can read" on public.docs
  for select using (has_capability('view_docs'));

drop policy if exists "manage_docs can read categories" on public.doc_categories;
create policy "view_docs can read categories" on public.doc_categories
  for select using (has_capability('view_docs'));
