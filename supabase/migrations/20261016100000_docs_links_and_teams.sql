-- Documentation: team targeting.
--  * teams: the teams a doc is most useful for (ids from meeting_groups, the Team tab). Empty means everyone. The home shows a person the docs for their own teams first.
alter table public.docs add column if not exists teams uuid[] not null default '{}';
