-- The initial notifications migration only allowed select/update by owner,
-- on the assumption every insert would go through a service-role client or
-- a security-definer function. The ticket-purchase route inserts a
-- "ticket confirmed" notification using the buyer's OWN authenticated
-- client though — simpler than pulling in a service-role client just for
-- that one insert. Letting someone insert a notification row for
-- THEMSELVES isn't a real security boundary (it's already their own data,
-- visible only to them); the check keeps it from being used to write into
-- anyone else's inbox, which is the actual thing worth guarding.

begin;

create policy "notifications insertable by self"
  on public.notifications for insert
  with check (auth.uid() = user_id);

commit;
