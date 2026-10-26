-- Staffle has no "cancelled" state any more (a Staffle that is not wanted is removed).
delete from public.staffles where status = 'cancelled';
alter table public.staffles drop constraint if exists staffles_status_check;
alter table public.staffles add constraint staffles_status_check check (status in ('draft', 'open', 'closed', 'drawn', 'ended'));
