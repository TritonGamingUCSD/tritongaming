import { accounts, tracker, day, svc } from './lib.mjs';
const t = tracker(); const acc = accounts('open');
try {
  const host = await acc.user('host', ['exec']);
  const rec = await acc.user('rec', ['recruit']);
  const off = await acc.user('off', ['officer']);
  const member = await acc.user('mem', ['ucsd']);
  const inactive = await acc.user('inact', ['officer', 'inactive']);
  const base = { repeat: 'once', date: day(2), start: '09:00', end: '10:00', group_ids: [] };
  const a = await host.call('POST', '/api/meetings/schedule', { ...base, title: 'ZZ Open Mtg', audience: [], invitees: [off.id] });
  const b = await host.call('POST', '/api/meetings/schedule', { ...base, title: 'ZZ Private Mtg', audience: [], invitees: [off.id], open_to_team: false });
  t.ok('created', a.s === 201 && b.s === 201, JSON.stringify([a.j, b.j]));
  const get = async (u) => (await u.call('GET', '/api/meetings/upcoming')).j;
  const zz = (l) => (l ?? []).filter((m) => m.title.startsWith('ZZ')).map((m) => m.title);
  let j = await get(rec); t.ok('recruit sees open one as guest', zz(j.open).join() === 'ZZ Open Mtg' && zz(j.meetings).length === 0, JSON.stringify(j));
  j = await get(off); t.ok('added officer sees both as theirs, no guest group', zz(j.meetings).length === 2 && zz(j.open).length === 0, JSON.stringify(j));
  j = await get(inactive); t.ok('inactive not added sees nothing', zz(j.open).length === 0 && zz(j.meetings).length === 0, JSON.stringify(j));
  const m = await member.call('GET', '/api/meetings/upcoming'); t.ok('plain member refused', m.s === 403, m.s);
} finally {
  await svc.from('meetings').delete().like('title', 'ZZ %');
  await svc.from('meeting_series').delete().like('title', 'ZZ %');
  await acc.cleanup();
  const { count } = await svc.from('meetings').select('id', { count: 'exact', head: true }).like('title', 'ZZ %'); console.log('leftover meetings', count);
}
process.exit(t.result());
