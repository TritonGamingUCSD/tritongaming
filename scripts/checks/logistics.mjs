// Logistics (equipment catalog), end to end against a running dev server, as temporary "ZZ" accounts: who may look and who may change, adding devices (individual and counted),
// duplicate IDs, history lines, the editable lists (add, rename that devices follow, delete only when unused), sponsors, and a permission granted directly.
// (Sponsor and officer-loaner devices are per event, in plans: see logistics-plans.mjs.)
// Everything it makes is deleted at the end. Run: BASE_URL=http://localhost:3222 node scripts/checks/logistics.mjs
import { accounts, svc, tracker } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('logi');
const createdDevices = [];
try {
  const exec = await user('exec', ['exec']);
  const officer = await user('officer', ['officer']);
  const officer2 = await user('officer2', ['officer']);
  const student = await user('student', ['ucsd']);

  // ---- who can look
  t.ok('a student cannot open Logistics', (await student.call('GET', '/api/logistics')).s === 403);
  const view = await officer.call('GET', '/api/logistics');
  t.ok('an officer can look', view.s === 200 && view.j.canManage === false);
  t.ok('the starting lists are there', view.j.lists?.type?.length >= 25 && view.j.lists.shelf.length >= 10 && view.j.lists.tier.length >= 6 && view.j.lists.kit.length > 5, JSON.stringify(Object.fromEntries(Object.entries(view.j.lists ?? {}).map(([k, v]) => [k, v.length]))));
  t.ok('Prizing is not a device type', !view.j.lists.type.some((x) => x.value === 'Prizing'));
  t.ok('the portal game list comes along', view.j.portalGames?.includes('Valorant'));
  const managed = await exec.call('GET', '/api/logistics');
  t.ok('exec can manage', managed.s === 200 && managed.j.canManage === true);

  // ---- an officer cannot change anything
  t.ok('officer cannot add a device', (await officer.call('POST', '/api/logistics/devices', { tag: 'ZZ-O1', type: 'Gaming PC' })).s === 403);
  t.ok('officer cannot add a list value', (await officer.call('POST', '/api/logistics/options', { kind: 'shelf', value: 'ZZ Shelf' })).s === 403);
  t.ok('officer cannot add a sponsor', (await officer.call('POST', '/api/logistics/sponsors', { name: 'ZZ Sponsor' })).s === 403);
  t.ok('officer cannot see the people picker', (await officer.call('GET', '/api/logistics/people')).s === 403);

  // ---- devices
  const noTag = await exec.call('POST', '/api/logistics/devices', { type: 'Gaming PC' });
  t.ok('an individual type needs an ID', noTag.s === 400, JSON.stringify(noTag));
  const a = await exec.call('POST', '/api/logistics/devices', { tag: 'ZZ1', name: 'Test PC', type: 'Gaming PC', shelf: 'Shelf A', tier: 'T1', condition: 'working', kit: [{ item: 'Power cable', qty: 1, missing: false }], games: ['Valorant'], ports: ['HDMI'], login: 'zz-login' });
  t.ok('exec adds a device', a.s === 201 && a.j.device?.tag === 'ZZ1', JSON.stringify(a));
  if (a.j.device) createdDevices.push(a.j.device.id);
  t.ok('the same ID is refused, however it is typed', (await exec.call('POST', '/api/logistics/devices', { tag: 'zz 1', type: 'Gaming PC' })).s === 409);
  t.ok('officers can see the login', (await officer.call('GET', '/api/logistics')).j.devices.some((d) => d.tag === 'ZZ1' && d.login === 'zz-login'));

  const bad = await exec.call('PATCH', `/api/logistics/devices/${a.j.device.id}`, { condition: 'smashed' });
  t.ok('a made-up condition is refused', bad.s === 400);
  const b = await exec.call('POST', '/api/logistics/devices', { tag: 'ZZ2', type: 'Monitor' });
  if (b.j.device) createdDevices.push(b.j.device.id);
  t.ok('a second device', b.s === 201);
  t.ok('an ID cannot be changed to one that exists', (await exec.call('PATCH', `/api/logistics/devices/${b.j.device.id}`, { tag: 'ZZ 1' })).s === 409);
  t.ok('an individual device cannot lose its ID', (await exec.call('PATCH', `/api/logistics/devices/${b.j.device.id}`, { tag: '' })).s === 400);

  const up = await exec.call('PATCH', `/api/logistics/devices/${a.j.device.id}`, { condition: 'dead', shelf: 'Shelf C', tier: 'T0', kit: [{ item: 'Power cable', qty: 1, missing: true }] });
  t.ok('exec edits a device', up.s === 200 && up.j.device.condition === 'dead' && up.j.device.shelf === 'Shelf C');
  const hist = await officer.call('GET', `/api/logistics/devices/${a.j.device.id}`);
  const lines = (hist.j.log ?? []).map((l) => l.summary);
  t.ok('the history says what changed', lines.includes('Condition: Not Tested → Dead') === false && lines.some((l) => l.startsWith('Condition: Working → Dead')) && lines.some((l) => l.startsWith('Moved: Shelf A · T1 → Shelf C · T0')) && lines.includes('Marked missing: Power cable') && lines.includes('Added to the catalog'), JSON.stringify(lines));
  t.ok('an officer can read the history', hist.s === 200 && hist.j.log?.[0]?.by);

  // ---- counted types (an estimated quantity)
  const ty = await exec.call('POST', '/api/logistics/options', { kind: 'type', value: 'ZZ Cables', counted: true });
  t.ok('a counted type is added', ty.s === 201 && ty.j.option?.counted === true, JSON.stringify(ty));
  const cnt = await exec.call('POST', '/api/logistics/devices', { type: 'ZZ Cables', shelf: 'Shelf C', tier: 'T2', quantity: 30, quantity_is_estimate: true });
  if (cnt.j.device) createdDevices.push(cnt.j.device.id);
  t.ok('a counted row needs no ID and keeps an estimated quantity', cnt.s === 201 && cnt.j.device.tag === null && cnt.j.device.quantity === 30 && cnt.j.device.quantity_is_estimate === true, JSON.stringify(cnt));
  const cnt2 = await exec.call('POST', '/api/logistics/devices', { type: 'ZZ Cables', quantity: 12, quantity_is_estimate: false });
  if (cnt2.j.device) createdDevices.push(cnt2.j.device.id);
  t.ok('two counted rows without an ID can sit side by side', cnt2.s === 201);

  // ---- lists
  const dup = await exec.call('POST', '/api/logistics/options', { kind: 'type', value: 'gaming pc' });
  t.ok('adding a value that exists just returns it', dup.s === 200 && dup.j.existed === true);
  const sh = await exec.call('POST', '/api/logistics/options', { kind: 'shelf', value: 'ZZ Shelf' });
  t.ok('a new shelf is added', sh.s === 201);
  await exec.call('PATCH', `/api/logistics/devices/${b.j.device.id}`, { shelf: 'ZZ Shelf' });
  t.ok('a shelf in use cannot be deleted', (await exec.call('DELETE', `/api/logistics/options/${sh.j.option.id}`)).s === 409);
  const rn = await exec.call('PATCH', `/api/logistics/options/${sh.j.option.id}`, { value: 'ZZ Shelf Renamed' });
  const afterRename = (await exec.call('GET', '/api/logistics')).j.devices.find((d) => d.id === b.j.device.id);
  t.ok('renaming a shelf moves the devices on it', rn.s === 200 && afterRename.shelf === 'ZZ Shelf Renamed', JSON.stringify(afterRename));
  const game = await exec.call('POST', '/api/logistics/options', { kind: 'game', value: 'ZZ Game' });
  await exec.call('PATCH', `/api/logistics/devices/${b.j.device.id}`, { games: ['ZZ Game'] });
  await exec.call('PATCH', `/api/logistics/options/${game.j.option.id}`, { value: 'ZZ Game 2' });
  t.ok('renaming a game follows into a device', (await exec.call('GET', '/api/logistics')).j.devices.find((d) => d.id === b.j.device.id).games.includes('ZZ Game 2'));
  const flip = await exec.call('PATCH', `/api/logistics/options/${ty.j.option.id}`, { counted: false });
  t.ok('a type can be switched from counted to individual', flip.s === 200 && (await exec.call('GET', '/api/logistics')).j.lists.type.find((x) => x.value === 'ZZ Cables').counted === false);
  await exec.call('PATCH', '/api/logistics/devices/' + b.j.device.id, { shelf: null, games: [] });
  t.ok('an unused shelf can be deleted', (await exec.call('DELETE', `/api/logistics/options/${sh.j.option.id}`)).s === 200);
  t.ok('an unused game can be deleted', (await exec.call('DELETE', `/api/logistics/options/${game.j.option.id}`)).s === 200);

  // ---- sponsors and owners
  const sp = await exec.call('POST', '/api/logistics/sponsors', { name: 'ZZ Sponsor', contact: 'zz@example.test' });
  t.ok('a sponsor is added', sp.s === 201);
  t.ok('a sponsor with no devices is removable', (await exec.call('DELETE', `/api/logistics/sponsors/${sp.j.sponsor.id}`)).s === 200);
  const people = await exec.call('GET', '/api/logistics/people');
  t.ok('the people picker lists officers (for a loaner at an event)', people.s === 200 && people.j.people.some((p) => p.id === officer.id));
  const od = await exec.call('POST', '/api/logistics/devices', { tag: 'ZZ4', type: 'Gaming Laptop', owner_type: 'sponsor', owner_note: 'ignored' });
  if (od.j.device) createdDevices.push(od.j.device.id);
  t.ok('the inventory has no owner field: it is the club’s devices only', od.s === 201 && od.j.device.owner_type === undefined);

  // ---- a permission granted straight to an officer
  t.ok('before the grant, officer2 cannot add', (await officer2.call('POST', '/api/logistics/devices', { tag: 'ZZ5', type: 'Mouse' })).s === 403);
  await svc.from('capability_grants').insert({ capability: 'manage_logistics', user_id: officer2.id });
  const g = await officer2.call('POST', '/api/logistics/devices', { tag: 'ZZ5', type: 'Mouse' });
  if (g.j.device) createdDevices.push(g.j.device.id);
  t.ok('after the grant, officer2 can add', g.s === 201, JSON.stringify(g));

  // ---- removing, and the audit log
  t.ok('exec removes a device', (await exec.call('DELETE', `/api/logistics/devices/${g.j.device.id}`)).s === 200);
  const { data: audit } = await svc.from('audit_log').select('action, entity_type').in('actor_id', made).eq('entity_type', 'logistics device');
  t.ok('adds and removals are in the audit log, and a removal is not a "delete" (which would alert every admin)', audit.some((x) => x.action === 'create') && audit.some((x) => x.action === 'remove') && !audit.some((x) => x.action === 'delete'), JSON.stringify(audit));
} finally {
  await svc.from('logistics_devices').delete().in('id', createdDevices);
  await svc.from('logistics_devices').delete().like('tag', 'ZZ%');
  await svc.from('logistics_options').delete().like('value', 'ZZ%');
  await svc.from('logistics_sponsors').delete().like('name', 'ZZ%');
  await svc.from('capability_grants').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await cleanup();
}
process.exit(t.result());
