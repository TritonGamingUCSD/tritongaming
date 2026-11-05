// Checks the division roles in the live database with throwaway accounts and two throwaway ZZ divisions, and removes everything it made. Run (no dev server needed): node scripts/checks/division-roles.mjs
// Covers: the three division roles need a division and the other roles must not have one, one division role per person per division, any number of divisions, the Rewards rule, and the role names.
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('divroles');
const divs = [];
async function division(name) {
  const { data } = await svc
    .from('divisions')
    .insert({ slug: `zz-divroles-${name}-${Date.now()}`, name: `ZZ Divroles ${name}` })
    .select('id')
    .single();
  divs.push(data.id);
  return data.id;
}
try {
  const a = await division('a'),
    b = await division('b');
  const p = await user('p', ['ucsd']);
  const set = (roles) => svc.rpc('admin_set_user_roles', { _user_id: p.id, _roles: roles, _granted_by: null });
  const rolesOf = async () => ((await svc.from('user_roles').select('role, division_id').eq('user_id', p.id)).data ?? []).map((r) => `${r.role}:${r.division_id ?? ''}`).sort();

  let r = await set([{ role: 'ucsd' }, { role: 'division_member', division_id: a }]);
  t.ok('a Division Member role saves with its division', !r.error && (await rolesOf()).includes(`division_member:${a}`), r.error?.message);
  r = await set([{ role: 'ucsd' }, { role: 'division_member' }]);
  t.ok('a Division Member without a division is refused', !!r.error);
  r = await set([{ role: 'ucsd' }, { role: 'division_alumni' }]);
  t.ok('Division Alumni without a division is refused', !!r.error);
  r = await set([{ role: 'ucsd' }, { role: 'officer', division_id: a }]);
  t.ok('a club role with a division is refused', !!r.error);
  r = await set([{ role: 'ucsd' }, { role: 'division_member', division_id: a }, { role: 'division', division_id: a }]);
  t.ok('two division roles in the same division are refused', !!r.error);
  r = await set([{ role: 'ucsd' }, { role: 'division', division_id: a }, { role: 'division_member', division_id: b }]);
  t.ok('a Head of one division can be a Member of another', !r.error && (await rolesOf()).length === 3, r.error?.message);
  r = await set([{ role: 'ucsd' }, { role: 'division_alumni', division_id: a }, { role: 'officer' }]);
  t.ok('Division Alumni can sit next to a club role', !r.error && (await rolesOf()).includes('officer:'), r.error?.message);

  const { data: elig1 } = await svc.rpc('is_rewards_eligible', { _user_id: p.id });
  t.ok('anyone with a division or club role earns no Rewards points', elig1 === false, String(elig1));
  await set([{ role: 'ucsd' }, { role: 'division_member', division_id: a }]);
  const { data: elig2 } = await svc.rpc('is_rewards_eligible', { _user_id: p.id });
  t.ok('a Division Member earns no Rewards points', elig2 === false, String(elig2));
  await set([{ role: 'ucsd' }]);
  const { data: elig3 } = await svc.rpc('is_rewards_eligible', { _user_id: p.id });
  t.ok('a plain student still earns them', elig3 === true, String(elig3));

  // names (the notification text is made by role_label)
  const labels = await Promise.all(['division', 'division_member', 'division_alumni'].map(async (role) => (await svc.rpc('role_label', { _role: role })).data));
  t.ok('role names read Division Head, Division Member and Division Alumni', labels.join('|') === 'Division Head|Division Member|Division Alumni', labels.join('|'));
} finally {
  for (const id of divs) await svc.from('divisions').delete().eq('id', id);
  await svc.from('role_change_log').delete().in('user_id', made);
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());
