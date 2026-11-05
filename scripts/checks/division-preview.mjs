// Checks, over HTTP against a running dev server with throwaway ZZ accounts, that a named person can preview the division features while they are admin-only, and nobody else can. Restores the setting afterwards.
// Run: node scripts/checks/division-preview.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('divprev');
let divId;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
const before = (await svc.from('team_settings').select('key, value').eq('key', 'divisions_preview').maybeSingle()).data;
const open = (await svc.from('team_settings').select('value').eq('key', 'divisions_open').maybeSingle()).data?.value;
try {
  if (open === 'on') throw new Error('Division features are open to everyone: this check needs them admin-only. Nothing was changed.');
  divId = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divprev-${Date.now()}`, name: 'ZZ Divprev' })
      .select('id')
      .single()
  ).data.id;
  const admin = await user('admin', ['admin']),
    head = await user('head', ['ucsd']),
    other = await user('other', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(other, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  const sees = async (u) => (await (await fetch(`http://localhost:3000/portal/zz-divprev-x`, { headers: { cookie: u.cookie }, redirect: 'manual' })).text()).includes('ZZ Divprev');
  const home = async (u) => (await (await fetch('http://localhost:3000/portal', { headers: { cookie: u.cookie }, redirect: 'manual' })).text()).includes('ZZ Divprev');
  t.ok('before: a Head cannot see the division features', !(await home(head)));
  const email = (await svc.auth.admin.getUserById(head.id)).data.user.email;
  t.ok('a non-admin cannot add a preview person', (await head.call('POST', '/api/admin/settings', { setting: 'divisions_preview', add_email: email })).s === 403);
  t.ok('an admin adds the Head by email', (await admin.call('POST', '/api/admin/settings', { setting: 'divisions_preview', add_email: email })).s === 200);
  t.ok('now the Head sees their division', await home(head));
  t.ok('but another Head does not', !(await home(other)));
  t.ok('an unknown address is a clear refusal', (await admin.call('POST', '/api/admin/settings', { setting: 'divisions_preview', add_email: 'nobody-zz@example.test' })).s === 404);
  t.ok('an admin removes them', (await admin.call('POST', '/api/admin/settings', { setting: 'divisions_preview', remove_id: head.id })).s === 200);
  t.ok('and they no longer see it', !(await home(head)));
  void sees;
} finally {
  if (before) await svc.from('team_settings').update({ value: before.value }).eq('key', 'divisions_preview');
  else await svc.from('team_settings').delete().eq('key', 'divisions_preview');
  if (divId) await svc.from('divisions').delete().eq('id', divId);
  await svc
    .from('role_change_log')
    .delete()
    .in('user_id', (await svc.from('profiles').select('id').like('display_name', 'ZZ Mtg%')).data?.map((p) => p.id) ?? []);
  await svc.from('audit_log').delete().like('summary', '%division features%');
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
