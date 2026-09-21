-- Corrects who's eligible for the Battlepass ("TG member" — officer,
-- lead, exec, recruit, alumni — not division, not admin on its own; see
-- src/lib/officerTiers.ts's BATTLEPASS_ROLES for the reasoning) in the
-- one place this was also baked into the database itself: the RLS policy
-- gating who can even see the shop catalog exists.
begin;

drop policy if exists "officer reward items readable by role holders" on public.officer_reward_items;

create policy "officer reward items readable by role holders"
  on public.officer_reward_items for select
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('officer', 'lead', 'exec', 'recruit', 'alumni')
  ));

commit;
