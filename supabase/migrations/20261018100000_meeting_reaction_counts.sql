-- Emoji reactions become plain running totals per meeting: how many of each emoji, with no record of who sent which and no limit on the total.
-- Additive: the old per-reaction table is left alone here so the site that is live now keeps working until the new code is out; it is dropped afterwards.
create table if not exists public.meeting_reaction_counts (
  meeting_id uuid   not null references public.meetings(id) on delete cascade,
  emoji      text   not null,
  count      bigint not null default 0,
  primary key (meeting_id, emoji)
);
alter table public.meeting_reaction_counts enable row level security;   -- service role only

-- One atomic step, so thousands of taps at once never lose a count.
create or replace function public.bump_meeting_reaction(p_meeting uuid, p_emoji text)
returns void language sql security definer set search_path = public as $$
  insert into public.meeting_reaction_counts (meeting_id, emoji, count) values (p_meeting, p_emoji, 1)
  on conflict (meeting_id, emoji) do update set count = public.meeting_reaction_counts.count + 1;
$$;
revoke all on function public.bump_meeting_reaction(uuid, text) from public, anon, authenticated;
grant execute on function public.bump_meeting_reaction(uuid, text) to service_role;

-- Keep the totals already counted for meetings that still have reactions stored.
insert into public.meeting_reaction_counts (meeting_id, emoji, count)
select meeting_id, emoji, count(*) from public.meeting_reactions group by meeting_id, emoji
on conflict (meeting_id, emoji) do update set count = excluded.count;
