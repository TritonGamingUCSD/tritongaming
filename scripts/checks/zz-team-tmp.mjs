import { accounts, tracker, day, svc } from './lib.mjs';
const t = tracker(); const acc = accounts('team');
try {
  const host = await acc.user('host', ['exec']);
  const act = await acc.user('act', ['officer']);
  const idle = await acc.user('idle', ['officer', 'inactive']);
  const named = await acc.user('named', ['officer', 'inactive']);
  const g = await host.call('POST', '/api/meetings/groups', { name: 'ZZ Team', member_ids: [act.id, idle.id, named.id] });
  t.ok('team made', g.s === 201 || g.s === 200, JSON.stringify(g.j));
  const gid = g.j.id ?? g.j.group?.id;
  const m = await host.call('POST', '/api/meetings/schedule', { title: 'ZZ Team Mtg', repeat: 'once', date: day(2), start: '09:00', end: '10:00', audience: [], group_ids: [gid], invitees: [named.id], open_to_team: false });
  t.ok('meeting made', m.s === 201, JSON.stringify(m.j));
  const seen = async (u) => ((await u.call('GET', '/api/meetings/upcoming')).j.meetings ?? []).filter((x) => x.title === 'ZZ Team Mtg').length;
  t.ok('active team member expected', await seen(act) === 1);
  t.ok('inactive team member NOT expected', await seen(idle) === 0);
  t.ok('inactive but named IS expected', await seen(named) === 1);
  const list = await host.call('GET', '/api/meetings/groups');
  const row = (list.j.groups ?? list.j).find((x) => x.id === gid);
  t.ok('team list still holds all 3', row?.member_ids.length === 3, JSON.stringify(row));
} finally {
  await svc.from('meetings').delete().like('title', 'ZZ %');
  await svc.from('meeting_groups').delete().like('name', 'ZZ %');
  await acc.cleanup();
  const a = await svc.from('meetings').select('id', { count: 'exact', head: true }).like('title', 'ZZ %');
  const b = await svc.from('meeting_groups').select('id', { count: 'exact', head: true }).like('name', 'ZZ %');
  console.log('leftover', a.count, b.count);
}
process.exit(t.result());
