-- Permanently deletes an event and everything hanging off it, in one
-- transaction. FK behavior today: tickets cascade, point_transactions and
-- photo_albums .event_id are SET NULL (which would silently leave orphaned
-- point rows behind), so this makes the cleanup explicit.
--
-- p_reverse_points = true  -> the event's check-in point awards are deleted,
--                             so attendees' balances (a sum over
--                             point_transactions) drop by what the event gave.
-- p_reverse_points = false -> those rows are kept (event_id/ticket_id become
--                             null) and attendees keep their points.
--
-- Only callable with the service role: the API route is the capability gate
-- (delete_events, admin-only), same pattern as the other points RPCs.
create or replace function public.admin_delete_event(
  p_event_id uuid,
  p_reverse_points boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tickets int;
  v_points int := 0;
  v_albums int;
  v_flyer text;
begin
  select flyer_url into v_flyer from events where id = p_event_id;
  if not found then
    raise exception 'Event not found' using errcode = 'P0002';
  end if;

  select count(*) into v_tickets from tickets where event_id = p_event_id;
  select count(*) into v_albums from photo_albums where event_id = p_event_id;

  if p_reverse_points then
    with d as (
      delete from point_transactions
      where type = 'event_checkin'
        and (event_id = p_event_id
             or ticket_id in (select id from tickets where event_id = p_event_id))
      returning 1
    )
    select count(*) into v_points from d;
  end if;

  -- Detach (not delete) album links, then remove the event — tickets go with
  -- it via ON DELETE CASCADE.
  update photo_albums set event_id = null where event_id = p_event_id;
  delete from events where id = p_event_id;

  return jsonb_build_object(
    'tickets_deleted', v_tickets,
    'point_rows_deleted', v_points,
    'albums_detached', v_albums,
    'flyer_url', v_flyer
  );
end;
$$;

revoke all on function public.admin_delete_event(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_delete_event(uuid, boolean) to service_role;
