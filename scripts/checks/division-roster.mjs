// Checks, over HTTP against a running dev server with throwaway ZZ accounts and a ZZ division, who may change a division's people: add by name or exact email, change a role, remove, and the "last Head" guard. Removes everything.
// Run: node scripts/checks/division-roster.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('divros');
let divId, otherDiv;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const rolesOf = async (u) => ((await svc.from('user_roles').select('role, division_id').eq('user_id', u.id)).data ?? []).filter((r) => r.division_id === divId).map((r) => r.role);
try {
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divros-a-${Date.now()}`, name: 'ZZ Divros A' })
      .select('id')
      .single()
  ).data.id;
  otherDiv = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divros-b-${Date.now()}`, name: 'ZZ Divros B' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']),
    member = await user('member', ['ucsd']),
    otherHead = await user('ohead', ['ucsd']),
    exec = await user('exec', ['exec']),
    newbie = await user('newbie', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);
  await setRoles(otherHead, [{ role: 'ucsd' }, { role: 'division', division_id: otherDiv }]);
  const path = `/api/divisions/${divId}/roster`;

  t.ok('a Member cannot add people', (await member.call('POST', path, { user_id: newbie.id, role: 'division_member' })).s === 403);
  t.ok('another division’s Head cannot', (await otherHead.call('POST', path, { user_id: newbie.id, role: 'division_member' })).s === 403);
  t.ok('a Member cannot search for people to add', (await member.call('GET', `${path}?search=ZZ`)).s === 403);
  const found = await head.call('GET', `${path}?search=${encodeURIComponent('ZZ Mtg newbie')}`);
  t.ok('a Head finds a person by name', found.s === 200 && found.j.matches?.some((m) => m.id === newbie.id), JSON.stringify(found.j).slice(0, 150));
  t.ok('the search never shows an email', !JSON.stringify(found.j).includes('@'));
  t.ok('a Head adds a Member', (await head.call('POST', path, { user_id: newbie.id, role: 'division_member' })).s === 200 && (await rolesOf(newbie)).includes('division_member'));
  t.ok(
    'a Head makes them Alumni (one role per division)',
    (await head.call('POST', path, { user_id: newbie.id, role: 'division_alumni' })).s === 200 && (await rolesOf(newbie)).join() === 'division_alumni',
  );
  const email = (await svc.auth.admin.getUserById(newbie.id)).data.user.email;
  t.ok(
    'a Head adds by an exact email address',
    (await head.call('POST', path, { email, role: 'division_member' })).s === 200 && (await rolesOf(newbie)).join() === 'division_member',
  );
  t.ok('an unknown email is a clear refusal', (await head.call('POST', path, { email: 'nobody-zz@example.test', role: 'division_member' })).s === 404);
  t.ok('a Head makes a co-Head', (await head.call('POST', path, { user_id: newbie.id, role: 'division' })).s === 200 && (await rolesOf(newbie)).join() === 'division');
  t.ok('the other division was not touched', (await svc.from('user_roles').select('role').eq('user_id', newbie.id).eq('division_id', otherDiv)).data?.length === 0);
  t.ok('with two Heads, one may step down', (await head.call('POST', path, { user_id: head.id, role: 'division_member' })).s === 200, 'with two Heads the demotion is allowed');
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(newbie, [{ role: 'ucsd' }]);
  t.ok('a lone Head cannot demote themselves', (await head.call('POST', path, { user_id: head.id, role: 'division_member' })).s === 409);
  t.ok('a lone Head cannot remove themselves', (await head.call('DELETE', path, { user_id: head.id })).s === 409);
  t.ok('exec can', (await exec.call('POST', path, { user_id: newbie.id, role: 'division_member' })).s === 200);
  t.ok('a Head removes a Member', (await head.call('DELETE', path, { user_id: newbie.id })).s === 200 && (await rolesOf(newbie)).length === 0);
  t.ok('they keep their other roles', (await svc.from('user_roles').select('role').eq('user_id', newbie.id).eq('role', 'ucsd')).data?.length === 1);
  t.ok('removing someone who is not in it changes nothing', (await head.call('DELETE', path, { user_id: newbie.id })).j.unchanged === true);
} finally {
  for (const id of [divId, otherDiv]) if (id) await svc.from('divisions').delete().eq('id', id);
  await svc
    .from('role_change_log')
    .delete()
    .in('user_id', (await svc.from('profiles').select('id').like('display_name', 'ZZ Mtg%')).data?.map((p) => p.id) ?? []);
  await svc.from('audit_log').delete().like('summary', '%division roster%');
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
