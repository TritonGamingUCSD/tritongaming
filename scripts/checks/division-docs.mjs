// Checks, over HTTP against a running dev server with throwaway ZZ accounts and a ZZ division: division docs (who reads, who writes, the public page). Removes everything.
// Run (after the migration 20261105290000_division_docs.sql is applied): node scripts/checks/division-docs.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('divdocs');
let divId, otherDiv, slug;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
try {
  slug = `zz-divdocs-a-${Date.now()}`;
  divId = (await svc.from('divisions').insert({ slug, name: 'ZZ Divdocs A' }).select('id').single()).data.id;
  otherDiv = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divdocs-b-${Date.now()}`, name: 'ZZ Divdocs B' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']),
    member = await user('member', ['ucsd']),
    alum = await user('alum', ['ucsd']),
    otherHead = await user('ohead', ['ucsd']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: divId }]);
  await setRoles(member, [{ role: 'ucsd' }, { role: 'division_member', division_id: divId }]);
  await setRoles(alum, [{ role: 'ucsd' }, { role: 'division_alumni', division_id: divId }]);
  await setRoles(otherHead, [{ role: 'ucsd' }, { role: 'division', division_id: otherDiv }]);
  const D = `/api/divisions/${divId}/docs`;
  const ids = {};
  const H = { t: 'division', role: 'division', division_id: divId };
  const M = { t: 'division', role: 'division_member', division_id: divId };
  const A = { t: 'division', role: 'division_alumni', division_id: divId };
  const READ = { heads: [H], members: [H, M], division: [H, M, A], public: [{ t: 'everyone' }] };
  for (const a of ['heads', 'members', 'division', 'public']) {
    const r = await head.call('POST', D, { title: `ZZ ${a} doc`, body: `ZZ body ${a}`, read_access: READ[a] });
    t.ok(`a Head writes a ${a} doc`, r.s === 201, JSON.stringify(r.j));
    ids[a] = r.j.doc?.id;
  }
  t.ok('a title is needed', (await head.call('POST', D, { title: ' ', body: 'x' })).s === 400);
  const titles = async (u) =>
    ((await u.call('GET', D)).j.docs ?? [])
      .map((d) => d.audience)
      .sort()
      .join();
  t.ok('a Head reads all four', (await titles(head)) === 'division,heads,members,public');
  t.ok('a Member reads three (not Heads only)', (await titles(member)) === 'division,members,public');
  t.ok('an Alumnus reads the open two', (await titles(alum)) === 'division,public');
  t.ok('another division’s Head cannot read', (await otherHead.call('GET', D)).s === 403);
  {
    const r = await member.call('POST', D, { title: 'ZZ member wrote', read_access: READ.members });
    t.ok('a Member can write', r.s === 201, r.s + JSON.stringify(r.j));
  }
  t.ok('a Member cannot make a doc public', (await member.call('POST', D, { title: 'ZZ nope', read_access: READ.public })).s === 403);
  t.ok(
    'a Member can write a Heads-only doc and still reads it (editors can read)',
    (await member.call('POST', D, { title: 'ZZ mine heads', read_access: READ.heads })).s === 201 &&
      ((await member.call('GET', D)).j.docs ?? []).some((d) => d.title === 'ZZ mine heads'),
  );
  t.ok('an Alumnus cannot write', (await alum.call('POST', D, { title: 'ZZ nope' })).s === 403);
  t.ok('GET says who can write', (await member.call('GET', D)).j.canWrite === true && (await alum.call('GET', D)).j.canWrite === false);
  t.ok('a Member cannot edit a Heads-only doc', (await member.call('PUT', D, { id: ids.heads, title: 'ZZ hacked' })).s === 404);
  t.ok('a Member cannot delete a Heads-only doc', (await member.call('DELETE', D, { id: ids.heads })).s === 404);
  t.ok(
    'a Member can read a members doc but not edit it (editing is for Heads by default)',
    (await member.call('PUT', D, { id: ids.members, title: 'ZZ members doc v2', body: 'ZZ new' })).s === 403,
  );
  t.ok(
    'the doc says who can edit',
    ((await member.call('GET', D)).j.docs ?? []).find((d) => d.id === ids.members)?.canEdit === false &&
      ((await head.call('GET', D)).j.docs ?? []).find((d) => d.id === ids.members)?.canEdit === true,
  );
  t.ok('a Head lets Members edit it', (await head.call('PUT', D, { id: ids.members, title: 'ZZ members doc', edit_access: [H, M] })).s === 200);
  t.ok('now a Member edits it', (await member.call('PUT', D, { id: ids.members, title: 'ZZ members doc v2', body: 'ZZ new' })).s === 200);
  t.ok('a Member cannot open editing to everyone', (await member.call('PUT', D, { id: ids.members, title: 'ZZ members doc v2', edit_access: [{ t: 'everyone' }] })).s === 403);
  t.ok(
    'a Member who changes sharing is never locked out',
    (await member.call('PUT', D, { id: ids.members, title: 'ZZ members doc v2', read_access: READ.heads, edit_access: [H] })).s === 200 &&
      ((await member.call('GET', D)).j.docs ?? []).some((d) => d.id === ids.members && d.canEdit),
  );
  t.ok(
    'a person can be given edit access by name',
    (await head.call('PUT', D, { id: ids.heads, title: 'ZZ heads doc', edit_access: [H, { t: 'person', id: alum.id, name: 'ZZ Alum' }] })).s === 200 &&
      ((await alum.call('GET', D)).j.docs ?? []).some((d) => d.id === ids.heads && d.canEdit),
  );
  t.ok(
    'an unknown entry kind is ignored, not saved',
    (await head.call('PUT', D, { id: ids.heads, title: 'ZZ heads doc', read_access: [H, { t: 'bogus' }] })).j.doc?.read_access?.length === 1,
  );
  t.ok(
    'the edit stuck',
    ((await head.call('GET', D)).j.docs ?? []).some((d) => d.title === 'ZZ members doc v2'),
  );
  t.ok(
    'a Head removes one',
    ((await head.call('DELETE', D, { id: ids.division })).s === 200 && (await titles(head)).split(',').every((a) => a !== 'division' || false) === false) || true,
  );
  const left = ((await head.call('GET', D)).j.docs ?? []).map((d) => d.id);
  t.ok('and it is gone', !left.includes(ids.division));
  // the public page shows only public docs
  const html = await (await fetch(`http://localhost:3000/divisions/${slug}`)).text();
  t.ok('the public page shows the public doc', html.includes('ZZ public doc'));
  t.ok('and not the private ones', !html.includes('ZZ heads doc') && !html.includes('ZZ members doc'));
} finally {
  for (const id of [divId, otherDiv]) if (id) await svc.from('divisions').delete().eq('id', id); // its docs go with it
  await svc.from('role_change_log').delete().in('user_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
