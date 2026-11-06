// Checks, over HTTP against a running dev server with throwaway ZZ accounts and two ZZ divisions: a division's broadcasts and channels are separate from the club's and from other divisions' (who sees what, who changes what, the public Watch page). Removes everything.
// Run (after migration 20261106190000_division_broadcasts.sql is applied): node scripts/checks/division-broadcast.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('divbc');
let divA, divB, slugA;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
try {
  slugA = `zz-divbc-a-${Date.now()}`;
  divA = (await svc.from('divisions').insert({ slug: slugA, name: 'ZZ Divbc A' }).select('id').single()).data.id;
  divB = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divbc-b-${Date.now()}`, name: 'ZZ Divbc B' })
      .select('id')
      .single()
  ).data.id;
  const admin = await user('admin', ['ucsd', 'admin']);
  const head = await user('head', ['ucsd']);
  const member = await user('member', ['ucsd']);
  const otherHead = await user('ohead', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divA }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divA }]);
  await setRoles(otherHead, [{ role: 'ucsd' }, { role: 'division', division_id: divB }]);
  const start = new Date(Date.now() + 86400000).toISOString();

  const made1 = await head.call('POST', '/api/broadcasts', { title: 'ZZ Division show', starts_at: start, division_id: divA });
  t.ok('a division Head schedules a broadcast for the division', made1.s === 200 && made1.j.id, JSON.stringify(made1.j));
  const id = made1.j.id;
  t.ok(
    'the Head sees it in the division list',
    ((await head.call('GET', `/api/broadcasts?division=${divA}`)).j.broadcasts ?? []).some((b) => b.id === id),
  );
  t.ok('a Member sees the schedule but cannot change it', (await member.call('GET', `/api/broadcasts?division=${divA}`)).j.canManage === false);
  t.ok('a Member cannot schedule', (await member.call('POST', '/api/broadcasts', { title: 'ZZ nope', starts_at: start, division_id: divA })).s === 403);
  t.ok('a Member cannot add a role', (await member.call('POST', `/api/broadcasts/${id}/roles`, { role: 'Producer', name: 'ZZ x' })).s === 403);
  t.ok('a Head adds a role', (await head.call('POST', `/api/broadcasts/${id}/roles`, { role: 'Producer', user_id: member.id })).s === 200);
  t.ok('another division’s Head cannot read it', (await otherHead.call('GET', `/api/broadcasts?division=${divA}`)).s === 403);
  t.ok('or change it', (await otherHead.call('PATCH', `/api/broadcasts/${id}`, { status: 'live' })).s === 403);
  t.ok('the club’s admin list does not show it', !((await admin.call('GET', '/api/broadcasts')).j.broadcasts ?? []).some((b) => b.id === id));
  t.ok('and the Head cannot open the club’s list', (await head.call('GET', '/api/broadcasts')).s === 403);
  t.ok('the Head marks it live', (await head.call('PATCH', `/api/broadcasts/${id}`, { status: 'live' })).s === 200);

  // channels are kept apart
  t.ok('a Head sets the division’s channel', (await head.call('PUT', '/api/broadcast/channels', { division_id: divA, twitch: 'zzdivchannel' })).j.twitch === 'zzdivchannel');
  t.ok('another division’s Head cannot', (await otherHead.call('PUT', '/api/broadcast/channels', { division_id: divA, twitch: 'zzother' })).s === 403);
  t.ok('the division’s channel is its own', (await head.call('GET', `/api/broadcast/channels?division=${divA}`)).j.twitch === 'zzdivchannel');
  t.ok('the club’s channel is untouched', (await head.call('GET', '/api/broadcast/channels')).j.twitch !== 'zzdivchannel');

  // the public Watch pages
  const base = process.env.BASE_URL ?? 'http://localhost:3000';
  const page = await (await fetch(`${base}/watch/${slugA}`)).text();
  t.ok('the division’s Watch page shows its own live show', /ZZ Division show/.test(page) && /zzdivchannel/.test(page));
  const club = await (await fetch(`${base}/watch`)).text();
  t.ok('and the club’s Watch page does not', !/ZZ Division show/.test(club) && !/zzdivchannel/.test(club));
  const missing = await fetch(`${base}/watch/zz-no-such-division`);
  t.ok('an unknown division has no Watch page', missing.status === 404 || /not found/i.test(await missing.text()));
} finally {
  await svc.from('broadcasts').delete().in('division_id', [divA, divB].filter(Boolean));
  await svc
    .from('team_settings')
    .delete()
    .in('key', [`broadcast_twitch:${divA}`, `broadcast_youtube:${divA}`]);
  await svc.from('divisions').delete().in('id', [divA, divB].filter(Boolean));
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
