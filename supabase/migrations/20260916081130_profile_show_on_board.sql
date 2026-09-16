-- Officer opt-in for the public About page's board section (which now
-- pulls live from profiles instead of an admin-managed content block — see
-- getBoardMembers). exec/lead/admin always appear there regardless of this
-- flag; officer only appears if they've turned this on themselves. division
-- never appears (they have their own division pages). No trigger needed
-- here the way org_title needed one — setting this true does nothing for
-- someone who isn't also exec/lead/officer/admin, since getBoardMembers
-- checks role membership first.
alter table public.profiles add column if not exists show_on_board boolean not null default false;
