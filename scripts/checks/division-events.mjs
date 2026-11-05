// Checks the database rules for a division's events with throwaway accounts, one throwaway ZZ division and ZZ events, as each kind of person (through the same rules the browser is under). Removes everything.
// Run (no dev server needed, after the migration 20261105220000_division_events.sql is applied): node scripts/checks/division-events.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('divev');
const events = [];
let divId, otherDiv;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const body = (title, over = {}) => ({
  title,
  slug: `zz-divev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  start_date: hours(24),
  end_date: hours(27),
  is_published: false,
  ...over,
});
try {
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divev-a-${Date.now()}`, name: 'ZZ Divev A' })
      .select('id')
      .single()
  ).data.id;
  otherDiv = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divev-b-${Date.now()}`, name: 'ZZ Divev B' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']),
    member = await user('member', ['ucsd']),
    otherHead = await user('ohead', ['ucsd']),
    lead = await user('lead', ['lead']),
    officer = await user('officer', ['officer']),
    exec = await user('exec', ['exec']),
    plain = await user('plain', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);
  await setRoles(otherHead, [{ role: 'ucsd' }, { role: 'division', division_id: otherDiv }]);

  // creating
  let r = await head.client
    .from('events')
    .insert(body('ZZ Div event', { division_id: divId }))
    .select('id')
    .single();
  t.ok('a Head can create an event for their division', !r.error && !!r.data, r.error?.message);
  const evId = r.data?.id;
  if (evId) events.push(evId);
  r = await head.client
    .from('events')
    .insert(body('ZZ Not mine', { division_id: otherDiv }))
    .select('id')
    .single();
  t.ok('a Head cannot create an event for another division', !!r.error);
  r = await head.client.from('events').insert(body('ZZ TG event')).select('id').single();
  t.ok('a Head cannot create a Triton Gaming event', !!r.error);
  r = await member.client
    .from('events')
    .insert(body('ZZ Member event', { division_id: divId }))
    .select('id')
    .single();
  t.ok('a Member cannot create events', !!r.error);
  r = await lead.client.from('events').insert(body('ZZ Lead TG event')).select('id').single();
  t.ok('a TG lead can still create a Triton Gaming event', !r.error && !!r.data, r.error?.message);
  if (r.data?.id) events.push(r.data.id);
  r = await lead.client
    .from('events')
    .insert(body('ZZ Lead div event', { division_id: divId }))
    .select('id')
    .single();
  t.ok('a TG lead cannot create an event for a division', !!r.error);
  r = await exec.client
    .from('events')
    .insert(body('ZZ Exec div event', { division_id: divId }))
    .select('id')
    .single();
  t.ok('exec can create an event for any division', !r.error && !!r.data, r.error?.message);
  if (r.data?.id) events.push(r.data.id);

  // editing
  const upd = async (u, id, title) => (await u.client.from('events').update({ title }).eq('id', id).select('id')).data?.length === 1;
  t.ok('a Head can edit their division event', await upd(head, evId, 'ZZ Div event 2'));
  t.ok('another division’s Head cannot', !(await upd(otherHead, evId, 'ZZ hacked')));
  t.ok('a Member cannot', !(await upd(member, evId, 'ZZ hacked')));
  t.ok('a TG lead cannot edit a division event', !(await upd(lead, evId, 'ZZ hacked')));
  t.ok('exec can edit any division event', await upd(exec, evId, 'ZZ Div event 3'));
  const tgEv = (
    await svc
      .from('events')
      .insert(body('ZZ TG owned', { is_published: true }))
      .select('id')
      .single()
  ).data.id;
  events.push(tgEv);
  t.ok('a TG lead can edit a Triton Gaming event as before', await upd(lead, tgEv, 'ZZ TG owned 2'));
  t.ok('a division Head cannot edit a Triton Gaming event', !(await upd(head, tgEv, 'ZZ hacked')));

  // seeing drafts
  const seen = async (u, id) => ((await u.client.from('events').select('id').eq('id', id)).data ?? []).length === 1;
  t.ok('a Head sees their draft', await seen(head, evId));
  t.ok('a plain student does not see a division draft', !(await seen(plain, evId)));
  t.ok('another division’s Head does not see it', !(await seen(otherHead, evId)));
  t.ok('everyone sees a published Triton Gaming event', await seen(plain, tgEv));

  // tickets and check-in
  const tk = (await svc.from('tickets').insert({ event_id: evId, user_id: plain.id }).select('id').single()).data.id;
  const checkIn = async (u) => (await u.client.from('tickets').update({ checked_in_at: new Date().toISOString(), status: 'used' }).eq('id', tk).select('id')).data?.length === 1;
  t.ok('a Division Member can check people in to their division’s event', await checkIn(member));
  await svc.from('tickets').update({ checked_in_at: null, status: 'active' }).eq('id', tk);
  t.ok('a TG officer cannot check in at a division event', !(await checkIn(officer)));
  t.ok('another division’s Head cannot', !(await checkIn(otherHead)));

  // deleting
  const del = async (u, id) => {
    await u.client.from('events').delete().eq('id', id);
    return !((await svc.from('events').select('id').eq('id', id)).data ?? []).length;
  };
  t.ok('a Member cannot delete the event', !(await del(member, evId)));
  t.ok('a Head can delete their division event', await del(head, evId));
} finally {
  await svc.from('tickets').delete().in('event_id', events);
  for (const id of events) await svc.from('events').delete().eq('id', id);
  for (const id of [divId, otherDiv]) if (id) await svc.from('divisions').delete().eq('id', id);
  await svc.from('role_change_log').delete().in('user_id', made);
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
