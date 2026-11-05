-- Follow-up to 20261105220000_division_events.sql, found by scripts/checks/division-events.mjs.
-- 1. A Division Member's right to check people in to their division's event looked the event up with the rules of the events table, which hide a draft from a Member, so a draft's tickets could not be
--    checked in. The lookup is now a small function that is allowed to see the event (it only answers yes or no).
-- 2. The two old ticket rules let ANY officer (the check-in permission) read and update the tickets of ANY event. A division's event is now outside them: only that division's Members and Heads (and exec and admin)
--    check in its tickets, a Triton Gaming officer cannot. Nothing changes for Triton Gaming's own events (every event today).
-- Safe to run once.
create or replace function public.is_division_member_of_event(_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = _event and e.division_id is not null
      and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('division', 'division_member') and ur.division_id = e.division_id)
  );
$$;
create or replace function public.event_belongs_to_division(_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events e where e.id = _event and e.division_id is not null);
$$;
revoke all on function public.is_division_member_of_event(uuid), public.event_belongs_to_division(uuid) from public, anon;
grant execute on function public.is_division_member_of_event(uuid), public.event_belongs_to_division(uuid) to authenticated;

drop policy if exists "division members check in tickets" on public.tickets;
create policy "division members check in tickets" on public.tickets for update
  using (is_division_member_of_event(event_id) or (is_tg_staff() and event_belongs_to_division(event_id)))
  with check (is_division_member_of_event(event_id) or (is_tg_staff() and event_belongs_to_division(event_id)));
drop policy if exists "division members see their event tickets" on public.tickets;
create policy "division members see their event tickets" on public.tickets for select
  using (is_division_member_of_event(event_id) or (is_tg_staff() and event_belongs_to_division(event_id)));

drop policy if exists "checkin can update tickets" on public.tickets;
create policy "checkin can update tickets" on public.tickets for update
  using (has_capability('checkin') and not event_belongs_to_division(event_id))
  with check (has_capability('checkin') and not event_belongs_to_division(event_id));
drop policy if exists "users see their own tickets" on public.tickets;
create policy "users see their own tickets" on public.tickets for select
  using (auth.uid() = user_id or (has_capability('checkin') and not event_belongs_to_division(event_id)));
