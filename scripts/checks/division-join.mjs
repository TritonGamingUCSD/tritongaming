// Checks, over HTTP against a running dev server with throwaway ZZ accounts and a ZZ division: asking to join (and the Heads answering) and division announcements. Removes everything.
// Run (after the migration 20261105270000_division_join_announcements.sql is applied): node scripts/checks/division-join.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('divjoin');
let divId, otherDiv;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const rolesOf = async (u) => ((await svc.from('user_roles').select('role, division_id').eq('user_id', u.id)).data ?? []).filter((r) => r.division_id === divId).map((r) => r.role);
try {
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divjoin-a-${Date.now()}`, name: 'ZZ Divjoin A' })
      .select('id')
      .single()
  ).data.id;
  otherDiv = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divjoin-b-${Date.now()}`, name: 'ZZ Divjoin B' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']),
    member = await user('member', ['ucsd']),
    otherHead = await user('ohead', ['ucsd']),
    student = await user('student', ['ucsd']),
    student2 = await user('student2', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);
  await setRoles(otherHead, [{ role: 'ucsd' }, { role: 'division', division_id: otherDiv }]);
  const J = `/api/divisions/${divId}/join`,
    R = `/api/divisions/${divId}/join-requests`,
    A = `/api/divisions/${divId}/announcements`;

  // join requests
  t.ok('a student starts with no request', (await student.call('GET', J)).j.status === 'none');
  t.ok('a student asks to join', (await student.call('POST', J, { message: 'ZZ I play a lot' })).s === 201);
  t.ok('their status is pending', (await student.call('GET', J)).j.status === 'pending');
  t.ok('asking twice is refused', (await student.call('POST', J, {})).s === 409);
  t.ok('a member of the division cannot ask', (await member.call('POST', J, {})).s === 409);
  t.ok('a Member cannot see the requests', (await member.call('GET', R)).s === 403);
  t.ok('another division’s Head cannot see them', (await otherHead.call('GET', R)).s === 403);
  const waiting = await head.call('GET', R);
  const mine = waiting.j.requests?.find((r) => r.user_id === student.id);
  t.ok('the Head sees the request with the message', waiting.s === 200 && mine?.message === 'ZZ I play a lot', JSON.stringify(waiting.j).slice(0, 120));
  t.ok('the Head was notified', ((await svc.from('notifications').select('id').eq('user_id', head.id).eq('type', 'division_join')).data ?? []).length >= 1);
  t.ok('a Member cannot answer it', (await member.call('PATCH', R, { id: mine.id, action: 'approve' })).s === 403);
  t.ok('the Head approves', (await head.call('PATCH', R, { id: mine.id, action: 'approve' })).s === 200 && (await rolesOf(student)).join() === 'division_member');
  t.ok('the student is told', ((await svc.from('notifications').select('id').eq('user_id', student.id).eq('type', 'division_join')).data ?? []).length >= 1);
  t.ok('answering again is refused', (await head.call('PATCH', R, { id: mine.id, action: 'approve' })).s === 404);
  t.ok('the student is now a member', (await student.call('GET', J)).j.status === 'member');
  t.ok(
    'another student asks, then withdraws',
    (await student2.call('POST', J, {})).s === 201 && (await student2.call('DELETE', J)).s === 200 && (await student2.call('GET', J)).j.status === 'none',
  );
  await student2.call('POST', J, {});
  const second = (await head.call('GET', R)).j.requests?.find((r) => r.user_id === student2.id);
  t.ok(
    'the Head declines',
    (await head.call('PATCH', R, { id: second.id, action: 'decline' })).s === 200 &&
      (await student2.call('GET', J)).j.status === 'declined' &&
      (await rolesOf(student2)).length === 0,
  );

  // closing join requests
  t.ok('a Member cannot close join requests', (await member.call('PUT', R, { open: false })).s === 403);
  t.ok('a Head closes them', (await head.call('PUT', R, { open: false })).s === 200 && (await head.call('GET', R)).j.open === false);
  t.ok('a student then sees it is closed', (await student2.call('GET', J)).j.closed === true);
  t.ok('and cannot ask', (await student2.call('DELETE', J)).s === 200 && (await student2.call('POST', J, {})).s === 403);
  t.ok('a Head opens them again', (await head.call('PUT', R, { open: true })).s === 200 && (await student2.call('POST', J, {})).s === 201);

  // announcements
  t.ok('a Member cannot post', (await member.call('POST', A, { title: 'ZZ nope' })).s === 403);
  t.ok('a title is needed', (await head.call('POST', A, { title: '  ' })).s === 400);
  const posted = await head.call('POST', A, { title: 'ZZ Practice moved', body: 'ZZ to 7pm' });
  t.ok('a Head posts one', posted.s === 201 && !!posted.j.announcement?.id, JSON.stringify(posted.j));
  t.ok('the Members are notified', ((await svc.from('notifications').select('id').eq('user_id', member.id).eq('type', 'division_announcement')).data ?? []).length >= 1);
  t.ok(
    'a Member reads it',
    (await member.call('GET', A)).j.announcements?.some((a) => a.id === posted.j.announcement.id),
  );
  t.ok('another division’s Head cannot read it', (await otherHead.call('GET', A)).s === 403);
  t.ok('a Member cannot remove it', (await member.call('DELETE', A, { id: posted.j.announcement.id })).s === 403);
  t.ok('the Head removes it', (await head.call('DELETE', A, { id: posted.j.announcement.id })).s === 200 && !((await head.call('GET', A)).j.announcements ?? []).length);
} finally {
  for (const id of [divId, otherDiv]) if (id) await svc.from('divisions').delete().eq('id', id); // its requests and announcements go with it
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('role_change_log').delete().in('user_id', made);
  await svc.from('audit_log').delete().like('summary', '%join a division%');
  await svc.from('audit_log').delete().like('summary', '%division announcement%');
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
