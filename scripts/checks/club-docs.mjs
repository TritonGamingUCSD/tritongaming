// Checks, over HTTP and with a signed-in database client, against a running dev server with throwaway ZZ accounts: club documentation access (the old rule, the two lists, a person for a limited time, request access, the check-a-person lookup, the history, and the database's own row rules). Removes everything.
// Run (after migration 20261106200000_club_doc_access.sql is applied): node scripts/checks/club-docs.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('clubdocs');
let docId;
const inList = async (u) => ((await u.call('GET', '/api/docs/sync')).j.docs ?? []).some((d) => d.id === docId);
try {
  const lead = await user('lead', ['ucsd', 'lead']);
  const officer = await user('officer', ['ucsd', 'officer']);
  const exec = await user('exec', ['ucsd', 'exec']);
  docId = (
    await svc
      .from('docs')
      .insert({ title: 'ZZ Access Doc', slug: `zz-access-${Date.now() % 100000}`, content: 'ZZ body', published: true, created_by: lead.id, updated_by: lead.id })
      .select('id')
      .single()
  ).data.id;

  // the old rule: no lists yet
  t.ok('with no lists, a lead reads it', (await lead.call('GET', `/api/docs/get?id=${docId}`)).s === 200);
  t.ok('and an officer reads it too (the docs permission)', (await officer.call('GET', `/api/docs/get?id=${docId}`)).s === 200);
  t.ok('a lead may edit it', (await lead.call('GET', `/api/docs/get?id=${docId}`)).j.doc?.can_edit === true);
  t.ok('an officer may not', (await officer.call('POST', '/api/docs/meta', { id: docId, pinned: true })).s === 403);

  // two lists
  const roleL = { t: 'role', role: 'lead' };
  const put = await lead.call('PUT', '/api/docs/access', { id: docId, read_access: [roleL], edit_access: [roleL] });
  t.ok('a lead gives the doc its own lists', put.s === 200, JSON.stringify(put.j));
  t.ok('an officer no longer finds it (the route)', (await officer.call('GET', `/api/docs/get?id=${docId}`)).s === 404);
  t.ok('or in the list of docs', !(await inList(officer)) && (await inList(lead)));
  const { data: seen } = await officer.client.from('docs').select('id').eq('id', docId);
  t.ok('and the database hides it from the officer too', (seen ?? []).length === 0);
  t.ok('the lead still sees it in the database', ((await lead.client.from('docs').select('id').eq('id', docId)).data ?? []).length === 1);
  t.ok('exec always gets in', (await exec.call('GET', `/api/docs/get?id=${docId}`)).s === 200);
  t.ok('an officer cannot change the sharing', (await officer.call('PUT', '/api/docs/access', { id: docId, read_access: [{ t: 'role', role: 'officer' }] })).s === 404);
  t.ok(
    'club docs are never open to everyone signed in',
    (await lead.call('PUT', '/api/docs/access', { id: docId, read_access: [roleL, { t: 'signed_in' }, { t: 'everyone' }] })).j.read?.length === 1,
  );

  // request access
  const me = await officer.call('GET', `/api/docs/access?id=${docId}&mine=1`);
  t.ok('an officer is told it exists but is closed to them', me.j.exists === true && me.j.canRead === false && !JSON.stringify(me.j).includes('ZZ Access'));
  t.ok('they ask for access', (await officer.call('POST', '/api/docs/access', { id: docId, message: 'ZZ please' })).s === 200);
  t.ok('asking twice is harmless', (await officer.call('POST', '/api/docs/access', { id: docId, message: 'again' })).j.ok === true);
  const shown = await lead.call('GET', `/api/docs/access?id=${docId}`);
  const reqRow = (shown.j.requests ?? [])[0];
  t.ok('the lead sees the request', shown.s === 200 && reqRow?.userId === officer.id, JSON.stringify(shown.j.requests));
  const { data: bell } = await svc.from('notifications').select('id').eq('user_id', lead.id).eq('type', 'doc_access_request');
  t.ok('and was told', (bell ?? []).length >= 1);
  const ok = await lead.call('PATCH', '/api/docs/access', { id: docId, request_id: reqRow?.id, decision: 'approve', days: 7 });
  t.ok('the lead says yes for 7 days', ok.s === 200, JSON.stringify(ok.j));
  t.ok('now the officer reads it', (await officer.call('GET', `/api/docs/get?id=${docId}`)).s === 200 && (await inList(officer)));
  t.ok('but still cannot edit', (await officer.call('POST', '/api/docs/meta', { id: docId, pinned: true })).s === 403);
  t.ok('and the database shows it to them', ((await officer.client.from('docs').select('id').eq('id', docId)).data ?? []).length === 1);
  const who = await lead.call('GET', `/api/docs/access?id=${docId}&check=${officer.id}`);
  t.ok(
    'check-a-person says can read, not edit, and why',
    who.j.read === true && who.j.edit === false && (who.j.why ?? []).some((w) => /read list/i.test(w)),
    JSON.stringify(who.j),
  );
  t.ok('the officer was told yes', ((await svc.from('notifications').select('id').eq('user_id', officer.id).eq('type', 'doc_access_answer')).data ?? []).length >= 1);

  // time runs out
  const lists = (await svc.from('docs').select('read_access').eq('id', docId).single()).data.read_access;
  await svc
    .from('docs')
    .update({ read_access: lists.map((e) => (e.t === 'person' ? { ...e, until: '2020-01-01' } : e)) })
    .eq('id', docId);
  t.ok('when the day passes, access ends', (await officer.call('GET', `/api/docs/get?id=${docId}`)).s === 404);
  t.ok('in the database too', ((await officer.client.from('docs').select('id').eq('id', docId)).data ?? []).length === 0);

  // edit rights by name
  await lead.call('PUT', '/api/docs/access', { id: docId, edit_access: [roleL, { t: 'person', id: officer.id }] });
  t.ok('a person given edit rights may edit (and so read)', (await officer.call('POST', '/api/docs/meta', { id: docId, pinned: true })).s === 200);
  t.ok('and sees the edit flag', (await officer.call('GET', `/api/docs/get?id=${docId}`)).j.doc?.can_edit === true);

  // history
  const log = (await lead.call('GET', `/api/docs/access?id=${docId}`)).j.log ?? [];
  t.ok('the changes are in the history', log.length >= 3, JSON.stringify(log.slice(0, 2)));
} finally {
  if (docId) await svc.from('docs').delete().eq('id', docId);
  await svc.from('notifications').delete().in('user_id', made);
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
