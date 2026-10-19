-- Reactions are counted on the host's screen and saved in batches. Each batch carries the id of the phone message it came from; an id is counted once, so two open screens
-- (or a resend after a failed save) never double the totals. Additive: the old per-tap function and the wall table are left alone here and cleaned up afterwards.
create table if not exists public.meeting_reaction_batches (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  batch_id   text not null,
  primary key (meeting_id, batch_id)
);
alter table public.meeting_reaction_batches enable row level security;   -- service role only

create or replace function public.record_meeting_reactions(p_meeting uuid, p_batches jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare x jsonb; k text; v text;
begin
  for x in select * from jsonb_array_elements(p_batches) loop
    insert into public.meeting_reaction_batches (meeting_id, batch_id) values (p_meeting, x->>'b') on conflict do nothing;
    if found then
      for k, v in select * from jsonb_each_text(x->'r') loop
        -- only the club's own approved emojis, and a sane number per message
        if k like 'custom:%' and v ~ '^[0-9]+$' and v::int between 1 and 25
           and exists (select 1 from public.custom_emojis ce where 'custom:' || ce.id::text = k and ce.status = 'approved') then
          insert into public.meeting_reaction_counts (meeting_id, emoji, count) values (p_meeting, k, v::bigint)
          on conflict (meeting_id, emoji) do update set count = public.meeting_reaction_counts.count + excluded.count;
        end if;
      end loop;
    end if;
  end loop;
end;
$$;
revoke all on function public.record_meeting_reactions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_meeting_reactions(uuid, jsonb) to service_role;
