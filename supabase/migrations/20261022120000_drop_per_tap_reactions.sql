-- Reactions are saved in batches now (record_meeting_reactions) and wall stickers live only on the screen, so the per-tap function and the wall table are no longer used.
drop function if exists public.bump_meeting_reaction(uuid, text);
drop table if exists public.meeting_wall;
