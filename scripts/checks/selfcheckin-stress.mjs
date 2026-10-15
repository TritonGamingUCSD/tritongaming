// Pushes self check-in with many requests at the same moment and checks the database afterwards: no duplicate tickets, no double points, no server errors.
// Run against a dev server: npm run test:selfcheckin-stress (about a minute; it makes ~30 temporary accounts and removes them).
import { createHmac } from 'node:crypto';
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker(); const ok = t.ok;
const { user, made, cleanup } = accounts('stress');
const eventIds = [];
const code = (secret, w) => (BigInt(`0x${createHmac('sha256', secret).update(String(w)).digest('hex').slice(0, 12)}`) % 1000000n).toString().padStart(6, '0');
const win = () => Math.floor(Date.now() / 1000 / 30);
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const pacificDay = (d) => new Date(d.getTime() - 8 * 3600e3).toISOString().slice(0, 10);
async function event(title, over = {}) {
  const { data, error } = await svc.from('events').insert({ title, slug: `zz-stress-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, start_date: hours(-1), end_date: hours(2), points_value: 5, is_published: true, self_checkin_mode: 'until_end', ...over }).select('id').single();
  if (error) throw error; eventIds.push(data.id); return data.id;
}
const ready = async (name, roles = ['ucsd']) => { const u = await user(name, roles); await svc.from('profile_private').upsert({ user_id: u.id, gender: 'Other' }); return u; };
const tickets = async (eventId) => (await svc.from('tickets').select('id, user_id, status').eq('event_id', eventId)).data ?? [];
const awards = async (eventId) => (await svc.from('point_transactions').select('user_id, reversed_at').eq('event_id', eventId).eq('type', 'event_checkin')).data ?? [];
const serverErrors = (rs) => rs.filter((r) => r.s >= 500).length;
const dupes = (rows, key) => rows.length - new Set(rows.map(key)).size;

try {
  const N = 20;   // each temporary account needs one sign-in check, and Supabase allows only ~30 of those per 5 minutes from one address
  const staff = await user('exec', ['exec']);
  const people = [];
  for (let i = 0; i < N; i += 5) people.push(...await Promise.all(Array.from({ length: Math.min(5, N - i) }, (_, k) => ready(`p${i + k}`))));

  // 1. Many different people at once
  const ev1 = await event('ZZ Stress Crowd');
  const t0 = Date.now();
  const rs1 = await Promise.all(people.map((p) => p.call('POST', '/api/checkin/self', { event_id: ev1 })));
  const ms = Date.now() - t0;
  ok(`${N} different people at once: all checked in, no server errors`, rs1.every((r) => r.s === 200 && r.j.status === 'checked_in'), JSON.stringify(rs1.filter((r) => r.s !== 200).slice(0, 2)));
  const tk1 = await tickets(ev1), aw1 = await awards(ev1);
  ok(`one ticket each (${tk1.length}) and all used`, tk1.length === N && tk1.every((x) => x.status === 'used') && dupes(tk1, (x) => x.user_id) === 0);
  ok(`one point award each (${aw1.length})`, aw1.length === N && dupes(aw1, (x) => x.user_id) === 0);
  console.log(`   ${N} requests finished in ${ms} ms`);

  // 2. One person tapping many times at once
  const ev2 = await event('ZZ Stress Taps');
  const solo = people[18];
  const rs2 = await Promise.all(Array.from({ length: 15 }, () => solo.call('POST', '/api/checkin/self', { event_id: ev2 })));
  ok('15 taps at once from one person: no server errors, all answered 200', serverErrors(rs2) === 0 && rs2.every((r) => r.s === 200), JSON.stringify(rs2.filter((r) => r.s !== 200).slice(0, 2)));
  ok('exactly one "checked in", the rest "already"', rs2.filter((r) => r.j.status === 'checked_in').length === 1, JSON.stringify(rs2.map((r) => r.j.status)));
  ok('one ticket and one award', (await tickets(ev2)).length === 1 && (await awards(ev2)).length === 1);

  // 3. A staff scan and the person's own check-in at the same moment, 10 people
  const ev3 = await event('ZZ Stress Race');
  const racers = people.slice(0, 10);
  const rows = (await Promise.all(racers.map(async (p) => (await svc.from('tickets').insert({ event_id: ev3, user_id: p.id }).select('id, ticket_code').single()).data)));
  const rs3 = await Promise.all(racers.flatMap((p, i) => [
    p.call('POST', '/api/checkin/self', { event_id: ev3 }),
    staff.call('POST', '/api/tickets/checkin', { code: code(rows[i].ticket_code, win()), event_id: ev3 }),
  ]));
  ok('staff scan racing self check-in: no server errors', serverErrors(rs3) === 0, JSON.stringify(rs3.filter((r) => r.s >= 500).slice(0, 2)));
  const aw3 = await awards(ev3);
  ok(`staff vs self: exactly one award per person (${aw3.length} for 10)`, aw3.length === 10 && dupes(aw3, (x) => x.user_id) === 0);
  ok('every ticket ends up used once', (await tickets(ev3)).every((x) => x.status === 'used'));

  // 4. The setting flipped while people are checking in
  const ev4 = await event('ZZ Stress Flip');
  const flippers = people.slice(10, 20);
  const rs4 = await Promise.all([
    ...flippers.map((p) => p.call('POST', '/api/checkin/self', { event_id: ev4 })),
    staff.call('PATCH', `/api/events/${ev4}/self-checkin`, { mode: 'off' }),
    staff.call('PATCH', `/api/events/${ev4}/self-checkin`, { mode: 'forever' }),
    staff.call('PATCH', `/api/events/${ev4}/self-checkin`, { mode: 'until_end' }),
  ]);
  ok('flipping the setting mid-rush: no server errors', serverErrors(rs4) === 0, JSON.stringify(rs4.filter((r) => r.s >= 500).slice(0, 2)));
  ok('every check-in answer is a clean yes or "closed"', rs4.slice(0, flippers.length).every((r) => (r.s === 200 && ['checked_in', 'already'].includes(r.j.status)) || (r.s === 403 && r.j.code === 'closed')), JSON.stringify(rs4.slice(0, flippers.length).map((r) => `${r.s}${r.j.code ?? ''}`)));
  const { data: ev4row } = await svc.from('events').select('self_checkin_mode').eq('id', ev4).single();
  ok('the setting ends on one of the three valid values', ['off', 'until_end', 'forever'].includes(ev4row.self_checkin_mode), ev4row.self_checkin_mode);
  const tk4 = await tickets(ev4), aw4 = await awards(ev4);
  ok('no duplicate tickets or awards after the flips', dupes(tk4, (x) => x.user_id) === 0 && dupes(aw4, (x) => x.user_id) === 0);

  // 5. A multi-day event, the same person at once on the same day
  const ev5 = await event('ZZ Stress Days', { start_date: hours(-30), end_date: hours(30), day_hours: [{ day: pacificDay(new Date(Date.now() - 86400e3)), start: '00:00', end: '23:59' }, { day: pacificDay(new Date()), start: '00:00', end: '23:59' }, { day: pacificDay(new Date(Date.now() + 86400e3)), start: '00:00', end: '23:59' }] });
  const rs5 = await Promise.all(Array.from({ length: 10 }, () => people[19].call('POST', '/api/checkin/self', { event_id: ev5 })));
  ok('multi-day: 10 taps at once, no server errors', serverErrors(rs5) === 0 && rs5.every((r) => r.s === 200), JSON.stringify(rs5.filter((r) => r.s !== 200).slice(0, 2)));
  const { data: days } = await svc.from('ticket_checkins').select('day').eq('event_id', ev5);
  ok(`multi-day: one check-in row for today (${days?.length})`, days?.length === 1);
  ok('multi-day: one award', (await awards(ev5)).length === 1);

  // 6. Two exec changing the setting at once 
  const ev6 = await event('ZZ Stress Modes');
  const modes = ['off', 'until_end', 'forever'];
  const rs6 = await Promise.all(Array.from({ length: 12 }, (_, i) => staff.call('PATCH', `/api/events/${ev6}/self-checkin`, { mode: modes[i % 3] })));
  ok('12 simultaneous setting changes: all answered cleanly', rs6.every((r) => r.s === 200), JSON.stringify(rs6.filter((r) => r.s !== 200).slice(0, 2)));
} finally {
  for (const id of eventIds) { await svc.from('ticket_checkins').delete().eq('event_id', id); await svc.from('point_transactions').delete().eq('event_id', id); await svc.from('tickets').delete().eq('event_id', id); await svc.from('events').delete().eq('id', id); }
  await svc.from('profile_private').delete().in('user_id', made);
  await svc.from('notifications').delete().or('title.ilike.%ZZ %,body.ilike.%ZZ %');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().ilike('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
