#!/usr/bin/env node
// End-to-end permission checks against a RUNNING dev server (npm run dev) and the Supabase project in .env.local.
//   npm run test:permissions
// It creates temporary accounts named mtg-test-*@example.test (one per role), drives the real API routes as each of them,
// and deletes everything it made. It never targets real people: every meeting / event it creates is addressed to the
// temporary accounts by id only (never by role), so nobody real is notified.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const svc = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY);
const ref = new URL(url).hostname.split('.')[0];
const stamp = Date.now();

let passed = 0; const failures = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else failures.push(`${name}${detail ? ` (${detail})` : ''}`); };

const users = {};
async function mk(role) {
  const email = `mtg-test-${role}-${stamp}@example.test`;
  const { data } = await svc.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user.id;
  await svc.from('profiles').update({ display_name: `Test ${role}`, onboarded_at: new Date().toISOString() }).eq('id', id);
  await svc.from('user_roles').insert({ user_id: id, role });
  const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: lk } = await svc.auth.admin.generateLink({ type: 'magiclink', email });
  const { data: s } = await c.auth.verifyOtp({ token_hash: lk.properties.hashed_token, type: 'magiclink' });
  users[role] = { id, cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}` };
}
async function call(who, path, method = 'GET', body) {
  const r = await fetch(BASE + path, { method, headers: { Cookie: users[who]?.cookie ?? '', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return [r.status, json];
}
const pacificHHMM = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(Date.now() + ms));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

const meetingIds = [], eventIds = [], ticketIds = [], groupIds = [];
try {
  for (const r of ['admin', 'exec', 'lead', 'officer', 'recruit', 'alumni', 'division']) await mk(r);
  const U = (r) => users[r].id;

  // ── Meetings: who can plan ──────────────────────────────────────────────────
  const meetingBody = { title: 'Perm check', repeat: 'once', date: today, start: pacificHHMM(-5 * 60_000), end: pacificHHMM(55 * 60_000), audience: [], invitees: [U('officer'), U('lead')], group_ids: [] };
  check('officer cannot plan meetings', (await call('officer', '/api/meetings/schedule', 'POST', meetingBody))[0] === 403);
  check('recruit cannot plan meetings', (await call('recruit', '/api/meetings/schedule', 'POST', meetingBody))[0] === 403);
  const [s1, m1] = await call('exec', '/api/meetings/schedule', 'POST', meetingBody); check('exec can plan meetings', s1 === 201);
  if (m1?.id) meetingIds.push(m1.id);
  const [s2, m2] = await call('lead', '/api/meetings/schedule', 'POST', { ...meetingBody, title: 'Lead meeting' }); check('lead can plan meetings', s2 === 201);
  if (m2?.id) meetingIds.push(m2.id);

  // ── Meetings: only listed people can check in, exec/admin included ─────────────
  await call('exec', '/api/meetings/open', 'POST', { meeting_id: m1.id });
  const [, live] = await call('exec', `/api/meetings/${m1.id}/live`);
  const code = String(live?.code?.code ?? live?.code ?? '');
  check('exec (not listed) cannot check in', (await call('exec', '/api/meetings/check-in', 'POST', { code }))[0] === 409);
  check('admin (not listed) cannot check in', (await call('admin', '/api/meetings/check-in', 'POST', { code }))[0] === 409);
  check('recruit (not listed) cannot check in', (await call('recruit', '/api/meetings/check-in', 'POST', { code }))[0] === 409);
  check('listed officer can check in', (await call('officer', '/api/meetings/check-in', 'POST', { code }))[0] === 200);
  const [, todays] = await call('recruit', '/api/meetings/today'); check('recruit does not see a meeting they are not on', !(todays?.meetings ?? []).some((m) => m.id === m1.id));
  const [, up] = await call('exec', '/api/meetings/upcoming'); check('exec upcoming excludes meetings they are not on', !(up?.meetings ?? []).some((m) => m.title === 'Perm check' && !m.hosting) || (up.meetings ?? []).every((m) => m.title !== 'Perm check' || m.hosting));
  check('lead cannot edit exec meeting', (await call('lead', '/api/meetings/update', 'POST', { meeting_id: m1.id, location: 'x' }))[0] === 403);
  check('lead can edit their own meeting', (await call('lead', '/api/meetings/update', 'POST', { meeting_id: m2.id, location: 'Room 1' }))[0] === 200);

  // ── Attendance results: exec/admin, hosts (own), nobody else ───────────────────
  check('exec can see attendance results', (await call('exec', '/api/meetings/attendance'))[0] === 200);
  check('lead can see their attendance results', (await call('lead', '/api/meetings/attendance'))[0] === 200);
  check('officer cannot see attendance results', (await call('officer', '/api/meetings/attendance'))[0] === 403);
  check('alumni cannot see attendance results', (await call('alumni', '/api/meetings/attendance'))[0] === 403);
  check('lead cannot export', (await call('lead', '/api/meetings/export?type=summary'))[0] === 403);
  check('exec can export', (await call('exec', '/api/meetings/export?type=summary'))[0] === 200);

  // ── Access: HR group gets attendance reports, nothing else ─────────────────────
  const { data: g } = await svc.from('meeting_groups').insert({ name: `Perm HR ${stamp}`, member_ids: [U('alumni')], created_by: U('admin') }).select('id').single(); groupIds.push(g.id);
  check('non-admin cannot grant access', (await call('exec', '/api/admin/access', 'POST', { capability: 'view_attendance_reports', group_id: g.id }))[0] === 403);
  check('cannot grant a role-only permission', (await call('admin', '/api/admin/access', 'POST', { capability: 'manage_roles', user_id: U('alumni') }))[0] === 400);
  check('admin can grant to a group', (await call('admin', '/api/admin/access', 'POST', { capability: 'view_attendance_reports', group_id: g.id }))[0] === 201);
  check('granted group member sees attendance results', (await call('alumni', '/api/meetings/attendance'))[0] === 200);
  check('granted group member can export', (await call('alumni', '/api/meetings/export?type=log'))[0] === 200);
  check('granted group member still cannot plan meetings', (await call('alumni', '/api/meetings/schedule', 'POST', meetingBody))[0] === 403);
  check('granted group member still cannot open check-in', (await call('alumni', '/api/meetings/open', 'POST', { meeting_id: m1.id }))[0] === 403);
  await svc.from('capability_grants').delete().eq('group_id', g.id);
  check('removing the grant removes the access', (await call('alumni', '/api/meetings/attendance'))[0] === 403);

  // ── Internal events ───────────────────────────────────────────────────────────
  const evBody = { title: 'Perm event', date: today, start: pacificHHMM(3_600_000), end: pacificHHMM(7_200_000), audience: [], invitees: [U('officer'), U('recruit')], group_ids: [] };
  check('officer cannot plan internal events', (await call('officer', '/api/internal-events', 'POST', evBody))[0] === 403);
  const [e1, ev] = await call('lead', '/api/internal-events', 'POST', evBody); check('lead can plan internal events', e1 === 201);
  if (ev?.id) eventIds.push(ev.id);
  const titles = async (r) => ((await call(r, '/api/internal-events'))[1]?.events ?? []).map((e) => e.title);
  check('invited officer sees it', (await titles('officer')).includes('Perm event'));
  check('invited recruit sees it', (await titles('recruit')).includes('Perm event'));
  check('not-invited exec does not see it', !(await titles('exec')).includes('Perm event'));
  check('alumni cannot open the section', (await call('alumni', '/api/internal-events'))[0] === 403);
  check('division lead cannot open the section', (await call('division', '/api/internal-events'))[0] === 403);
  check('invited recruit can RSVP', (await call('recruit', `/api/internal-events/${ev.id}/rsvp`, 'POST', { status: 'going' }))[0] === 200);
  check('not-invited exec cannot RSVP', (await call('exec', `/api/internal-events/${ev.id}/rsvp`, 'POST', { status: 'going' }))[0] === 403);
  check('bad RSVP value is rejected', (await call('officer', `/api/internal-events/${ev.id}/rsvp`, 'POST', { status: 'yes' }))[0] === 400);
  check('another lead cannot edit it', (await call('officer', `/api/internal-events/${ev.id}`, 'PATCH', { title: 'x' }))[0] === 403);
  check('exec can edit any internal event', (await call('exec', `/api/internal-events/${ev.id}`, 'PATCH', { location: 'Room 9' }))[0] === 200);
  const [, cal] = await call('officer', `/api/calendar?from=${today}&to=${today}`);
  check('calendar shows it as an internal event, not a meeting', (cal?.items ?? []).some((i) => i.title === 'Perm event' && i.kind === 'internal'));

  // ── Help tickets ──────────────────────────────────────────────────────────────
  const [h1, t] = await call('recruit', '/api/help', 'POST', { category: 'bug', subject: `Perm ticket ${stamp}`, body: 'testing' }); check('member can open a ticket', h1 === 201);
  const tid = t?.id;
  check('another member cannot read it', (await call('officer', `/api/help/${tid}`))[0] === 404);
  check('exec can read it', (await call('exec', `/api/help/${tid}`))[0] === 200);
  check('member cannot list everyone’s tickets', ((await call('recruit', '/api/help?scope=all'))[1]?.tickets ?? []).every((x) => x.user_id === U('recruit')));
  check('member cannot assign tickets', (await call('recruit', `/api/help/${tid}`, 'PATCH', { assigned_to: U('recruit') }))[0] === 403);
  check('member cannot use saved replies', (await call('recruit', '/api/help/canned'))[0] === 403);
  check('exec can use saved replies', (await call('exec', '/api/help/canned'))[0] === 200);

  // ── Calendar subscription link ────────────────────────────────────────────────
  const [, tok] = await call('officer', '/api/calendar/token');
  check('feed link works without signing in', (await fetch(tok.https)).status === 200);
  await call('officer', '/api/calendar/token', 'POST');
  check('resetting the link kills the old one', (await fetch(tok.https)).status === 404);
  check('a made-up token is not found', (await fetch(`${BASE}/api/calendar/feed/00000000-0000-0000-0000-000000000000.ics`)).status === 404);
} finally {
  if (meetingIds.length) await svc.from('meetings').delete().in('id', meetingIds);
  if (eventIds.length) await svc.from('internal_events').delete().in('id', eventIds);
  if (groupIds.length) { await svc.from('capability_grants').delete().in('group_id', groupIds); await svc.from('meeting_groups').delete().in('id', groupIds); }
  // A new help ticket notifies every real exec/admin; take those test notifications back out.
  await svc.from('notifications').delete().eq('title', `New help ticket: Perm ticket ${stamp}`);
  for (const u of Object.values(users)) {
    await svc.from('help_tickets').delete().eq('user_id', u.id);
    await svc.from('notifications').delete().eq('user_id', u.id);
    await svc.from('reminders_sent').delete().eq('user_id', u.id);
    await svc.auth.admin.deleteUser(u.id);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
