// Getting a ticket and checking in under load: 30 people claiming tickets at the same moment (each tapping twice, one tapping ten times), reading their tickets and QR codes while it happens, then
// checking in every way at once (self, staff scan, manual, online code, each person hit from two directions), then staff undoing check-ins together. It checks that nothing errors (no 5xx), nobody gets two
// tickets or two awards, no check-in is lost, and the points add up. Temporary "ZZ" accounts and a ZZ event; everything made is deleted.
// Run: BASE_URL=http://localhost:3101 PEOPLE=30 node scripts/checks/tickets-load.mjs   (a dev server is much slower than the real site: this looks for errors and wrong numbers, not speed)
import { createHmac } from 'node:crypto';
import { accounts, svc, tracker } from './lib.mjs';

const N = Number(process.env.PEOPLE ?? 30);
const t = tracker(); const ok = t.ok;
const { user, made, cleanup } = accounts('tickload');
const eventIds = [];
const code = (secret, w) => (BigInt(`0x${createHmac('sha256', secret).update(String(w)).digest('hex').slice(0, 12)}`) % 1000000n).toString().padStart(6, '0');
const win = () => Math.floor(Date.now() / 1000 / 30);
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const five = (rs) => rs.filter((r) => r.s >= 500).length;
const dupes = (rows, key) => rows.length - new Set(rows.map(key)).size;
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] ?? 0;
const timed = async (fn) => { const t0 = Date.now(); const r = await fn(); return { ...r, ms: Date.now() - t0 }; };
async function event(title, over = {}) {
  const { data, error } = await svc.from('events').insert({ title, slug: `zz-tickload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, start_date: hours(-1), end_date: hours(2), points_value: 5, is_published: true, self_checkin_mode: 'until_end', ...over }).select('id, checkin_secret').single();
  if (error) throw error; eventIds.push(data.id); return data;
}
const tickets = async (eventId) => (await svc.from('tickets').select('id, user_id, status, ticket_code').eq('event_id', eventId).limit(5000)).data ?? [];
const awards = async (eventId) => (await svc.from('point_transactions').select('user_id, amount, reversed_at').eq('event_id', eventId).eq('type', 'event_checkin').limit(5000)).data ?? [];

try {
  const staff = await user('exec', ['exec']);
  const people = [];
  for (let i = 0; i < N; i += 4) people.push(...await Promise.all(Array.from({ length: Math.min(4, N - i) }, async (_, k) => { const p = await user(`p${i + k}`, ['ucsd']); await svc.from('profile_private').upsert({ user_id: p.id, gender: 'Other' }); return p; })));
  console.log(`${people.length} people ready`);
  const ev = await event('ZZ Tickets Load');
  const E = ev.id;

  // ---- getting a ticket: everyone at once, twice each; one person ten extra times
  const claims = await Promise.all([...people.flatMap((p) => [p.call('POST', '/api/tickets', { event_id: E }), p.call('POST', '/api/tickets', { event_id: E })]), ...Array.from({ length: 10 }, () => people[0].call('POST', '/api/tickets', { event_id: E }))]);
  ok(`${N} people claim tickets at once (each twice): no server errors`, five(claims) === 0, JSON.stringify(claims.filter((r) => r.s >= 500).slice(0, 2)));
  ok('every answer is a ticket or "already registered"', claims.every((r) => r.s === 201 || r.s === 409), JSON.stringify(claims.filter((r) => r.s !== 201 && r.s !== 409).slice(0, 2)));
  const tk = await tickets(E);
  ok(`exactly one ticket per person (${tk.length} for ${N})`, tk.length === N && dupes(tk, (x) => x.user_id) === 0);
  ok('exactly one "created" answer per person', claims.filter((r) => r.s === 201).length === N);
  ok('every ticket has its own secret code', new Set(tk.map((x) => x.ticket_code)).size === N && tk.every((x) => x.ticket_code));
  const told = (await svc.from('notifications').select('user_id').eq('type', 'ticket_confirmed').in('user_id', people.map((p) => p.id))).data ?? [];
  ok('each person is told once that the ticket is confirmed', told.length === N && dupes(told, (x) => x.user_id) === 0, String(told.length));

  // ---- reading tickets and the QR code while others are still claiming (a second event, so the claims and the reads overlap)
  const ev2 = await event('ZZ Tickets Load Two');
  const mixed = await Promise.all(people.flatMap((p, i) => [
    p.call('POST', '/api/tickets', { event_id: ev2.id }),
    p.call('GET', '/api/tickets'),
    p.call('GET', `/api/tickets/${tk.find((x) => x.user_id === p.id).id}/qr`),
    p.call('GET', `/api/tickets/${tk.find((x) => x.user_id === p.id).id}/status`),
    ...(i % 3 === 0 ? [p.call('GET', '/api/tickets')] : []),
  ]));
  ok('claiming, listing tickets and opening the QR code and status all at once: no server errors', five(mixed) === 0, JSON.stringify(mixed.filter((r) => r.s >= 500).slice(0, 2)));
  const lists = mixed.filter((r) => r.j.tickets);
  ok('every list holds that person\'s tickets and no one else\'s', lists.every((r) => r.s === 200) && lists.length >= N && lists.every((r) => r.j.tickets.length >= 1 && r.j.tickets.length <= 2), JSON.stringify(lists.slice(0, 1)).slice(0, 200));
  const qrs = mixed.filter((r) => r.j.code || r.j.qr || r.j.codes || r.j.token);
  ok(`every QR request answered (${qrs.length} of ${N} carry a code)`, mixed.filter((r) => r.s === 200 || r.s === 201 || r.s === 409).length === mixed.length, JSON.stringify(mixed.filter((r) => ![200, 201, 409].includes(r.s)).slice(0, 2)));
  ok('the second event also has exactly one ticket per person', (await tickets(ev2.id)).length === N);
  ok('nobody can open someone else\'s QR code', (await people[1].call('GET', `/api/tickets/${tk.find((x) => x.user_id === people[0].id).id}/qr`)).s === 404);

  // ---- checking in every way at once. Thirds: (1) the person taps self check-in while staff scan their code, twice each; (2) staff check them in by hand, three times each; (3) they type the online code, twice each
  const third = Math.floor(N / 3);
  const g1 = people.slice(0, third), g2 = people.slice(third, 2 * third), g3 = people.slice(2 * third);
  const byUser = new Map(tk.map((x) => [x.user_id, x]));
  const w = win();   // a ticket's own code changes every 30 seconds; the event's online code every 5 minutes
  const t0 = Date.now();
  const checks = await Promise.all([
    ...g1.flatMap((p) => [p.call('POST', '/api/checkin/self', { event_id: E }), p.call('POST', '/api/checkin/self', { event_id: E }), staff.call('POST', '/api/tickets/checkin', { code: code(byUser.get(p.id).ticket_code, w), event_id: E }), staff.call('POST', '/api/tickets/checkin', { code: code(byUser.get(p.id).ticket_code, w), event_id: E })]),
    ...g2.flatMap((p) => [1, 2, 3].map(() => staff.call('POST', '/api/checkin/manual', { ticket_id: byUser.get(p.id).id }))),
    ...g3.flatMap((p) => [1, 2].map(() => p.call('POST', '/api/checkin/online', { event_id: E, code: code(ev.checkin_secret, Math.floor(Date.now() / 1000 / 300)) }))),
  ]);
  console.log(`  ${checks.length} check-in requests finished in ${Date.now() - t0} ms`);
  ok('check-in every way at once: no server errors', five(checks) === 0, JSON.stringify(checks.filter((r) => r.s >= 500).slice(0, 2)));
  ok('every answer is a clean yes or "already checked in"', checks.every((r) => r.s === 200 || r.s === 409), JSON.stringify(checks.filter((r) => r.s !== 200 && r.s !== 409).slice(0, 3)));
  const tk2 = await tickets(E), aw = await awards(E);
  ok(`every ticket ends up used (${tk2.filter((x) => x.status === 'used').length} of ${N})`, tk2.every((x) => x.status === 'used'));
  ok(`exactly one award per person (${aw.length} for ${N})`, aw.length === N && dupes(aw, (x) => x.user_id) === 0 && aw.every((x) => x.amount === 5));
  ok('nobody got double points', (await svc.from('point_transactions').select('user_id, amount').eq('type', 'event_checkin').eq('event_id', E).limit(5000)).data.reduce((n, x) => n + x.amount, 0) === 5 * N);
  const rows = (await svc.from('ticket_checkins').select('ticket_id').eq('event_id', E).limit(5000)).data ?? [];
  ok('one check-in record per ticket for today', rows.length === N && dupes(rows, (x) => x.ticket_id) === 0, String(rows.length));

  // ---- the whole door at once: staff scan every ticket again while people re-tap, nothing changes
  const again = await Promise.all([...people.map((p) => staff.call('POST', '/api/tickets/checkin', { code: code(byUser.get(p.id).ticket_code, w), event_id: E })), ...people.map((p) => p.call('POST', '/api/checkin/self', { event_id: E }))]);
  ok('scanning and tapping everyone again: no errors and no new points', five(again) === 0 && (await awards(E)).length === N);

  // ---- staff undo check-ins together, twice each; then check them in again by hand
  const undoing = g1.slice(0, 8);
  const rev = await Promise.all(undoing.flatMap((p) => [1, 2].map(() => staff.call('POST', '/api/checkin/reverse', { ticket_id: byUser.get(p.id).id }))));
  ok('undoing check-ins twice each at once: no server errors', five(rev) === 0, JSON.stringify(rev.filter((r) => r.s >= 500).slice(0, 2)));
  const awAfter = await awards(E);
  ok('each undone check-in has its points taken back once', undoing.every((p) => awAfter.filter((a) => a.user_id === p.id && !a.reversed_at).length === 0) && awAfter.filter((a) => !a.reversed_at).length === N - undoing.length, JSON.stringify(awAfter.filter((a) => a.reversed_at).length));
  const redo = await Promise.all(undoing.flatMap((p) => [1, 2].map(() => staff.call('POST', '/api/checkin/manual', { ticket_id: byUser.get(p.id).id }))));
  ok('checking them in again at once: no server errors', five(redo) === 0, JSON.stringify(redo.filter((r) => r.s >= 500).slice(0, 2)));
  const awRedo = await awards(E);
  ok('each is back to exactly one live award', undoing.every((p) => awRedo.filter((a) => a.user_id === p.id && !a.reversed_at).length === 1) && awRedo.filter((a) => !a.reversed_at).length === N);

  // ---- a burst of reads
  const burst = [];
  for (let i = 0; i < 150; i += 50) burst.push(...await Promise.all(Array.from({ length: 50 }, (_, k) => timed(() => people[(i + k) % N].call('GET', '/api/tickets')))));
  console.log(`  150 ticket list requests (50 at a time): ${burst.filter((r) => r.s === 200).length} ok, median ${pct(burst.map((r) => r.ms), 0.5)}ms, p95 ${pct(burst.map((r) => r.ms), 0.95)}ms`);
  ok('150 ticket list requests all succeed', burst.every((r) => r.s === 200));
  const junk = await Promise.all([people[0].call('POST', '/api/tickets', {}), people[0].call('POST', '/api/tickets', { event_id: 'nope' }), people[0].call('POST', '/api/tickets', { event_id: '00000000-0000-4000-8000-000000000000' }), people[0].call('POST', '/api/checkin/self', {}), people[0].call('POST', '/api/checkin/online', { event_id: E, code: 'abc' }), staff.call('POST', '/api/tickets/checkin', { code: 'zzz', event_id: E }), staff.call('POST', '/api/checkin/manual', { ticket_id: 'nope' }), people[0].call('GET', '/api/tickets/nope/qr')]);
  ok('junk input is refused with 4xx, never a 5xx', five(junk) === 0 && junk.every((r) => r.s >= 400), JSON.stringify(junk.map((r) => r.s)));
} finally {
  for (const id of eventIds) { await svc.from('ticket_checkins').delete().eq('event_id', id); await svc.from('point_transactions').delete().eq('event_id', id); await svc.from('tickets').delete().eq('event_id', id); await svc.from('events').delete().eq('id', id); }
  await svc.from('profile_private').delete().in('user_id', made);
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('notifications').delete().or('title.ilike.%ZZ %,body.ilike.%ZZ %');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().ilike('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
