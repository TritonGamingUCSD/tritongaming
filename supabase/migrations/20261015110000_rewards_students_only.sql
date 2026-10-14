-- Rewards are for UCSD students only. Anyone who holds any other role (recruit, alumni, officer, lead, exec, division lead, admin...) cannot earn points,
-- collect referral bonuses or claim rewards. Existing points stay in the ledger, hidden. Exec and admin still run Rewards from the Tools tab.
-- award_checkin_points, the referral bonus and claim_reward all call this function, so this is the one place that decides.
create or replace function public.is_rewards_eligible(_user_id uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'ucsd')
     and not exists (select 1 from public.user_roles where user_id = _user_id and role <> 'ucsd');
$$;
