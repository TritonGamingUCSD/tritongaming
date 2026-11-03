-- The Newspaper also writes event reminders ("starts soon" for ticket holders), so an issue's type may now be 'event_reminder', which follows the "Event reminders" opt-out.
-- The old "Send event emails" permission is folded into "Send the Newspaper": whoever was granted it (a person or a group) is granted the new one.
-- Safe to run once.
alter table public.newspaper_issues drop constraint if exists newspaper_issues_type_check;
alter table public.newspaper_issues add constraint newspaper_issues_type_check check (type in ('newspaper', 'event_announcement', 'event_update', 'event_reminder'));

insert into public.capability_grants (capability, user_id, group_id, granted_by, created_at)
select 'send_newspaper', user_id, group_id, granted_by, created_at from public.capability_grants where capability = 'send_event_emails'
on conflict do nothing;
delete from public.capability_grants where capability = 'send_event_emails';
