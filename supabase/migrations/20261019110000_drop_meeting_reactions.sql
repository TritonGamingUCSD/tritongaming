-- Emoji reactions are plain running totals now (meeting_reaction_counts), so the table that recorded who sent each one goes. First make sure no total is lower than what
-- the old rows hold (reactions sent after the totals were first copied but before the new code was live), then drop it.
insert into public.meeting_reaction_counts (meeting_id, emoji, count)
select meeting_id, emoji, count(*) from public.meeting_reactions group by meeting_id, emoji
on conflict (meeting_id, emoji) do update set count = greatest(public.meeting_reaction_counts.count, excluded.count);

drop table public.meeting_reactions;
