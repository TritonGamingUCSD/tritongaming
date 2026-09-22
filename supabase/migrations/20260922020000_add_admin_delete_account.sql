-- Backs two related admin tools in Member Management: deleting an account
-- outright, and merging a duplicate account (e.g. someone who
-- accidentally signed up twice — once with their personal Gmail, once
-- with their @ucsd.edu Google account, before linking them into one via
-- LinkGoogleSection) into the account they actually use.
--
-- The FK map this was built against (queried live from
-- information_schema, not assumed from migration files, since ON DELETE
-- behavior can drift from what a migration originally declared):
--   CASCADE (auto-deleted with the profile): notifications.user_id,
--     officer_point_transactions.user_id, officer_reward_redemptions.user_id,
--     point_transactions.user_id, reward_redemptions.user_id,
--     role_change_log.user_id, tickets.user_id, user_roles.user_id
--   SET NULL (auto-cleared): docs.created_by/updated_by,
--     point_transactions.related_user_id, profiles.referred_by
--   NO ACTION (blocks the delete unless handled first): events.created_by,
--     officer_point_transactions.created_by, officer_reward_items.created_by,
--     officer_reward_redemptions.cancelled_by/fulfilled_by,
--     photo_albums.created_by, point_transactions.created_by,
--     reward_items.created_by, reward_redemptions.cancelled_by/fulfilled_by,
--     role_change_log.changed_by, site_contents.updated_by,
--     tickets.checked_in_by, user_roles.granted_by
--
-- _reassign_to null = plain delete: NO ACTION attribution columns get
-- nulled out (the event/reward item/doc/etc itself survives, just loses
-- "who did this"); CASCADE-owned data (tickets, ledger entries, role
-- grants, etc.) is deleted along with the profile row, via the FKs above
-- doing their job — nothing extra to do for those here.
--
-- _reassign_to set = merge: NO ACTION columns are reassigned instead of
-- nulled, and CASCADE-owned data is explicitly moved to the keeper first
-- (so it survives instead of being cascade-deleted with the loser).
-- user_roles has a unique (user_id, role) index and point_transactions has
-- a partial unique index on related_user_id for active referral bonuses —
-- both guarded below so a role/referral the keeper already holds doesn't
-- 23505 the whole merge; the loser's redundant copy is just dropped.

begin;

create or replace function public.admin_delete_account(_user_id uuid, _admin_id uuid, _reassign_to uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _user_id = _admin_id then
    raise exception 'You cannot delete your own account this way.';
  end if;
  if _reassign_to is not null and _reassign_to = _user_id then
    raise exception 'Cannot merge an account into itself.';
  end if;
  if not exists (select 1 from public.profiles where id = _user_id) then
    raise exception 'Account not found.';
  end if;
  if _reassign_to is not null and not exists (select 1 from public.profiles where id = _reassign_to) then
    raise exception 'The account to merge into was not found.';
  end if;

  -- A plain delete (no merge target) that would remove the last admin
  -- would lock everyone out of Member Management — refuse it outright.
  if _reassign_to is null
    and exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
    and (select count(*) from public.user_roles where role = 'admin') <= 1
  then
    raise exception 'Cannot delete the only remaining admin account.';
  end if;

  -- NO ACTION attribution columns — reassign on merge, null on plain delete.
  update public.events set created_by = _reassign_to where created_by = _user_id;
  update public.officer_point_transactions set created_by = _reassign_to where created_by = _user_id;
  update public.officer_reward_items set created_by = _reassign_to where created_by = _user_id;
  update public.officer_reward_redemptions set cancelled_by = _reassign_to where cancelled_by = _user_id;
  update public.officer_reward_redemptions set fulfilled_by = _reassign_to where fulfilled_by = _user_id;
  update public.photo_albums set created_by = _reassign_to where created_by = _user_id;
  update public.point_transactions set created_by = _reassign_to where created_by = _user_id;
  update public.reward_items set created_by = _reassign_to where created_by = _user_id;
  update public.reward_redemptions set cancelled_by = _reassign_to where cancelled_by = _user_id;
  update public.reward_redemptions set fulfilled_by = _reassign_to where fulfilled_by = _user_id;
  update public.role_change_log set changed_by = _reassign_to where changed_by = _user_id;
  update public.site_contents set updated_by = _reassign_to where updated_by = _user_id;
  update public.tickets set checked_in_by = _reassign_to where checked_in_by = _user_id;
  update public.user_roles set granted_by = _reassign_to where granted_by = _user_id;

  if _reassign_to is not null then
    update public.user_roles set user_id = _reassign_to
      where user_id = _user_id
        and not exists (select 1 from public.user_roles ur2 where ur2.user_id = _reassign_to and ur2.role = user_roles.role);
    delete from public.user_roles where user_id = _user_id;

    update public.tickets set user_id = _reassign_to where user_id = _user_id;
    update public.notifications set user_id = _reassign_to where user_id = _user_id;
    update public.role_change_log set user_id = _reassign_to where user_id = _user_id;
    update public.officer_point_transactions set user_id = _reassign_to where user_id = _user_id;
    update public.reward_redemptions set user_id = _reassign_to where user_id = _user_id;
    update public.officer_reward_redemptions set user_id = _reassign_to where user_id = _user_id;

    update public.point_transactions set user_id = _reassign_to where user_id = _user_id;
    update public.point_transactions set related_user_id = _reassign_to
      where related_user_id = _user_id
        and not (type = 'referral_bonus' and reversed_at is null and exists (
          select 1 from public.point_transactions pt2
          where pt2.related_user_id = _reassign_to and pt2.type = 'referral_bonus' and pt2.reversed_at is null
        ));

    update public.docs set created_by = _reassign_to where created_by = _user_id;
    update public.docs set updated_by = _reassign_to where updated_by = _user_id;
    update public.profiles set referred_by = _reassign_to where referred_by = _user_id;
  end if;

  delete from public.profiles where id = _user_id;
end;
$$;

revoke all on function public.admin_delete_account(uuid, uuid, uuid) from public, anon, authenticated;

commit;
