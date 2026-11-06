// Checks, over HTTP against a running dev server with throwaway ZZ accounts: the admin feature switches (Admin → Settings). Only an admin flips them; an off switch blocks its routes, and every switch ends back on.
// Run: node scripts/checks/feature-switches.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('swt');
let divId;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const SWITCHES = ['tickets', 'self_checkin', 'polls', 'div_join', 'div_cohost', 'div_live', 'div_announce_notify', 'public_sponsors'];
try {
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-swt-${Date.now()}`, name: 'ZZ Swt A' })
      .select('id')
      .single()
  ).data.id;
  const admin = await user('admin', ['admin']),
    student = await user('student', ['ucsd']),
    head = await user('head', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  // A flip reaches the other requests a moment later (the server refreshes its cached copy), so each waits a little.
  const flip = async (key, on) => {
    const r = await admin.call('POST', '/api/admin/settings', { setting: 'switch', key, on });
    await new Promise((res) => setTimeout(res, 700));
    return r;
  };

  for (const k of SWITCHES) await flip(k, true); // start from all on (this also refreshes the server's cached copy)
  t.ok('a student cannot flip a switch', (await student.call('POST', '/api/admin/settings', { setting: 'switch', key: 'tickets', on: false })).s === 403);
  t.ok('an unknown switch is refused', (await flip('nope', false)).s === 400);
  const r = await flip('tickets', false);
  t.ok('an admin turns Ticket Sign-Ups off', r.s === 200 && r.j.settings?.off?.includes('tickets'), JSON.stringify(r.j).slice(0, 120));
  t.ok('a ticket request is refused', (await student.call('POST', '/api/tickets', { event_id: '00000000-0000-0000-0000-000000000000' })).s === 403);
  await flip('tickets', true);
  t.ok('back on, the refusal is gone', (await student.call('POST', '/api/tickets', { event_id: '00000000-0000-0000-0000-000000000000' })).s !== 403);

  await flip('self_checkin', false);
  t.ok('self check-in is refused while off', (await student.call('POST', '/api/checkin/self', { event_id: '00000000-0000-0000-0000-000000000000' })).s === 403);
  await flip('self_checkin', true);

  await flip('polls', false);
  t.ok('making a poll is refused while Polls is off', (await admin.call('POST', '/api/polls', { name: 'ZZ poll' })).s === 403);
  await flip('polls', true);

  await flip('div_join', false);
  t.ok('a student cannot ask to join while Join Requests is off', (await student.call('POST', `/api/divisions/${divId}/join`, {})).s === 403);
  t.ok('and the screen says closed', (await student.call('GET', `/api/divisions/${divId}/join`)).j.closed === true);
  await flip('div_join', true);
  const again = await student.call('POST', `/api/divisions/${divId}/join`, {});
  t.ok('back on, they can ask', again.s === 201, `${again.s} ${JSON.stringify(again.j)}`);
  await student.call('DELETE', `/api/divisions/${divId}/join`);

  t.ok('a Head sees partner divisions to co-host with', ((await head.call('GET', `/api/divisions/${divId}/events`)).j.partners ?? []).length > 0);
  await flip('div_cohost', false);
  t.ok('with Co-Hosting off the list of partners is empty', ((await head.call('GET', `/api/divisions/${divId}/events`)).j.partners ?? []).length === 0);
  await flip('div_cohost', true);

  t.ok(
    'a Head can pick their division for a new poll',
    ((await head.call('GET', '/api/live-owners')).j.divisions ?? []).some((d) => d.id === divId),
  );
  await flip('div_live', false);
  t.ok('with division Live Tools off, no division is offered', ((await head.call('GET', '/api/live-owners')).j.divisions ?? []).length === 0);
  t.ok('and a division poll is refused', (await head.call('POST', '/api/polls', { name: 'ZZ div poll', division_id: divId })).s === 403);
  await flip('div_live', true);

  await flip('div_announce_notify', false);
  const member = await user('member', ['ucsd']);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);
  t.ok('a Head still posts an announcement', (await head.call('POST', `/api/divisions/${divId}/announcements`, { title: 'ZZ quiet', body: 'x' })).s === 201);
  t.ok('but nobody is notified', ((await svc.from('notifications').select('id').eq('user_id', member.id).eq('type', 'division_announcement')).data ?? []).length === 0);
  await flip('div_announce_notify', true);

  const isGone = async () => /name="robots" content="noindex/i.test(await (await fetch('http://localhost:3000/sponsors')).text());
  const before = await isGone();
  await flip('public_sponsors', false);
  const during = await isGone();
  await flip('public_sponsors', true);
  t.ok('the sponsors page shows, then the not-found page while off, then shows again', !before && during && !(await isGone()), `${before} ${during}`);

  t.ok('the changes are in the audit log', ((await svc.from('audit_log').select('id').like('summary', 'Turned % off')).data ?? []).length >= 1);
} finally {
  await svc
    .from('team_settings')
    .delete()
    .in(
      'key',
      SWITCHES.map((k) => `sw_${k}`),
    );
  for (const k of ['sw_polls', 'sw_tickets']) await svc.from('team_settings').delete().eq('key', k);
  if (divId) await svc.from('divisions').delete().eq('id', divId);
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('role_change_log').delete().in('user_id', made);
  await svc.from('audit_log').delete().like('summary', 'Turned % o%');
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
