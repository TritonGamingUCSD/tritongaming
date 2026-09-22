-- Lets an admin set a custom display order for board-tier members
-- (exec/lead, plus any opted-in officer/alumni) — both getBoardMembers.ts
-- (public About page) and getMembersData.ts (portal Members tab) sorted
-- purely alphabetically within each role group before this, with no way
-- to put, say, the President first regardless of their name.
-- Null (the default) falls back to alphabetical, same as today — this is
-- additive, not a required field to fill in for every member.

begin;

alter table public.profiles add column if not exists board_order integer;

commit;
