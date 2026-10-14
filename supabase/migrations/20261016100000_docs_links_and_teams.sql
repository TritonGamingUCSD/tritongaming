-- Documentation: quick links and team targeting.
--  * kind: a normal how-to 'guide', or a 'link' (a short description with a button that opens a Google Drive file or other address).
--  * link_url: where a quick link goes.
--  * teams: the teams a doc is most useful for (ids from meeting_groups, the Team tab). Empty means everyone. The home shows a person the docs for their own teams first.
alter table public.docs add column if not exists kind text not null default 'guide' check (kind in ('guide', 'link'));
alter table public.docs add column if not exists link_url text;
alter table public.docs add column if not exists teams uuid[] not null default '{}';
