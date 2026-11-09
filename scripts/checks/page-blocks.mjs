// Checks, over HTTP against a running dev server with throwaway ZZ accounts and two ZZ divisions: who may save a page's draft and read its history, that publishing keeps a copy and clears the draft,
// and that drafts are not readable by everyone. Removes everything. Run (after migrations 20261108120000 and 20261108130000 are applied): node scripts/checks/page-blocks.mjs
import { createClient } from '@supabase/supabase-js';
import { svc, tracker, accounts, url, env } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('pgb');
let a, b;
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
try {
  a = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-pgb-a-${Date.now() % 100000}`, name: 'ZZ Pgb A' })
      .select('id')
      .single()
  ).data.id;
  b = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-pgb-b-${Date.now() % 100000}`, name: 'ZZ Pgb B' })
      .select('id')
      .single()
  ).data.id;
  const head = await user('head', ['ucsd']);
  const other = await user('other', ['ucsd']);
  const stu = await user('stu', ['ucsd']);
  const admin = await user('admin', ['ucsd', 'admin']);
  await setRoles(head, [{ role: 'ucsd' }, { role: 'division', division_id: a }]);
  await setRoles(other, [{ role: 'ucsd' }, { role: 'division', division_id: b }]);
  const Q = `type=division&id=${a}`;
  const blocks = [{ type: 'hero', title: 'ZZ Draft Banner' }, { type: 'text', markdown: 'ZZ draft text' }, { type: 'nope' }];

  t.ok('a student cannot save a draft', (await stu.call('PUT', '/api/page-blocks', { type: 'division', id: a, blocks })).s === 403);
  t.ok("another division's head cannot", (await other.call('PUT', '/api/page-blocks', { type: 'division', id: a, blocks })).s === 403);
  t.ok('and cannot read its history', (await other.call('GET', `/api/page-blocks?${Q}`)).s === 403);
  t.ok('bad input is refused', (await head.call('PUT', '/api/page-blocks', { type: 'division', id: 'nope', blocks })).s === 400);
  const saved = await head.call('PUT', '/api/page-blocks', { type: 'division', id: a, blocks });
  t.ok('the head saves a draft (junk blocks dropped)', saved.s === 200 && saved.j.count === 2, JSON.stringify(saved.j));
  let g = await head.call('GET', `/api/page-blocks?${Q}`);
  t.ok('the draft comes back', g.j.draft?.blocks?.length === 2 && g.j.versions.length === 0, JSON.stringify(g.j).slice(0, 200));
  t.ok('the visible page is untouched', ((await svc.from('divisions').select('page_blocks').eq('id', a).single()).data.page_blocks ?? []).length === 0);
  // anyone with the public key cannot read drafts
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const pub = await anon.from('page_block_drafts').select('*');
  t.ok('drafts are not publicly readable', !pub.error ? (pub.data ?? []).length === 0 : true);
  const pubV = await anon.from('page_block_versions').select('*');
  t.ok('nor the history', !pubV.error ? (pubV.data ?? []).length === 0 : true);
  const pubD = await anon.from('divisions').select('*').eq('id', a).single();
  t.ok('the public division row carries no draft', !('page_blocks_draft' in (pubD.data ?? {})));

  // publish: the division PATCH (what the form's Save does)
  const pub1 = await head.call('PATCH', '/api/divisions', { id: a, page_blocks: [{ id: 'k1', type: 'text', markdown: 'ZZ published one' }] });
  t.ok('the head publishes', pub1.s === 200, JSON.stringify(pub1.j).slice(0, 160));
  g = await head.call('GET', `/api/page-blocks?${Q}`);
  t.ok('publishing clears the draft and keeps a version', g.j.draft === null && g.j.versions.length === 1 && g.j.versions[0].count === 1, JSON.stringify(g.j).slice(0, 220));
  await head.call('PATCH', '/api/divisions', { id: a, page_blocks: [{ id: 'k1', type: 'text', markdown: 'ZZ published one' }] });
  t.ok('saving the same blocks again adds no version', (await head.call('GET', `/api/page-blocks?${Q}`)).j.versions.length === 1);
  await head.call('PATCH', '/api/divisions', {
    id: a,
    page_blocks: [
      { id: 'k1', type: 'text', markdown: 'ZZ published two' },
      { id: 'k2', type: 'divider' },
    ],
  });
  g = await head.call('GET', `/api/page-blocks?${Q}`);
  t.ok('a change adds one (newest first)', g.j.versions.length === 2 && g.j.versions[0].count === 2 && g.j.versions[1].count === 1);
  const old = await head.call('GET', `/api/page-blocks/versions/${g.j.versions[1].id}?${Q}`);
  t.ok('an old version can be loaded', old.j.blocks?.[0]?.markdown === 'ZZ published one', JSON.stringify(old.j).slice(0, 160));
  t.ok('but not through another division', (await other.call('GET', `/api/page-blocks/versions/${g.j.versions[1].id}?${Q}`)).s === 403);
  // discard
  await head.call('PUT', '/api/page-blocks', { type: 'division', id: a, blocks });
  t.ok('a draft can be discarded', (await head.call('DELETE', `/api/page-blocks?${Q}`)).s === 200 && (await head.call('GET', `/api/page-blocks?${Q}`)).j.draft === null);
  t.ok('admin may edit any page', (await admin.call('GET', `/api/page-blocks?type=division&id=${b}`)).s === 200);
} finally {
  for (const id of [a, b])
    if (id) {
      await svc.from('page_block_drafts').delete().eq('entity_id', id);
      await svc.from('page_block_versions').delete().eq('entity_id', id);
      await svc.from('divisions').delete().eq('id', id);
    }
  await svc.from('role_change_log').delete().like('summary', '%ZZ%');
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
