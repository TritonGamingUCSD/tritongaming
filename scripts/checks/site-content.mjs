// Checks, over HTTP against a running dev server with throwaway ZZ accounts: Site Content drafts and history (who may use them, publishing keeps a copy and clears the draft, drafts are not public) and the Page Builder on a club page
// (blocks are cleaned on save and appear in the right places on the home page). Removes everything.
// Run (after migration 20261108140000 is applied): node scripts/checks/site-content.mjs
import { createClient } from '@supabase/supabase-js';
import { svc, tracker, accounts, BASE, url, env } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('stc');
const KEY = 'builder.homepage';
try {
  const lead = await user('exec', ['ucsd', 'exec']);
  const stu = await user('stu', ['ucsd']);
  await svc.from('site_contents').delete().eq('key', KEY);
  await svc.from('site_content_versions').delete().eq('key', KEY);
  await svc.from('site_content_drafts').delete().eq('key', KEY);
  const Q = `key=${KEY}`;

  t.ok('a student cannot read the history', (await stu.call('GET', `/api/admin/content/history?${Q}`)).s === 403);
  t.ok('nor save a draft', (await stu.call('PUT', '/api/admin/content/history', { key: KEY, content: { blocks: [] } })).s === 403);
  t.ok('an unknown block is refused', (await lead.call('GET', '/api/admin/content/history?key=nope.nope')).s === 404);
  const d = await lead.call('PUT', '/api/admin/content/history', { key: KEY, content: { blocks: [{ type: 'divider' }] } });
  t.ok('an exec saves a draft', d.s === 200, JSON.stringify(d.j));
  let g = await lead.call('GET', `/api/admin/content/history?${Q}`);
  t.ok('the draft comes back', g.j.draft?.content?.blocks?.length === 1 && g.j.versions.length === 0);
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const pub = await anon.from('site_content_drafts').select('*');
  t.ok('drafts are not public', !pub.error ? (pub.data ?? []).length === 0 : true);
  const pubV = await anon.from('site_content_versions').select('*');
  t.ok('nor the history', !pubV.error ? (pubV.data ?? []).length === 0 : true);

  // publish (the editor's Save): junk is dropped, the draft goes, a version is kept
  const blocks = [
    { id: 'zt', type: 'text', markdown: 'ZZ TOP BLOCK', slot: 'top' },
    { id: 'ze', type: 'text', markdown: 'ZZ AFTER EVENTS', slot: 'after:events' },
    { id: 'zb', type: 'text', markdown: 'ZZ BOTTOM BLOCK' },
    { id: 'zx', type: 'text', markdown: 'ZZ BAD SLOT', slot: 'after:../etc' },
    { id: 'zv', type: 'video', url: 'https://evil.example/v' },
    { id: 'zj', type: 'hero', title: 'ZZ Hero', image: 'javascript:alert(1)' },
  ];
  const pubRes = await lead.call('POST', '/api/admin/content', { key: KEY, content: { blocks } });
  t.ok('an exec publishes', pubRes.s === 200, JSON.stringify(pubRes.j));
  const row = (await svc.from('site_contents').select('content').eq('key', KEY).single()).data.content;
  t.ok(
    'junk is dropped on save (bad video; the hero keeps no script address)',
    row.blocks.length === 5 && !row.blocks.some((b) => b.type === 'video') && row.blocks.find((b) => b.type === 'hero')?.image === '',
    JSON.stringify(row).slice(0, 300),
  );
  t.ok('a bad place is dropped (the block goes last)', row.blocks.find((b) => b.id === 'zx')?.slot === undefined);
  g = await lead.call('GET', `/api/admin/content/history?${Q}`);
  t.ok('publishing cleared the draft and kept a version', g.j.draft === null && g.j.versions.length === 1);
  const old = await lead.call('GET', `/api/admin/content/history/${g.j.versions[0].id}?${Q}`);
  t.ok('a version can be loaded', old.j.content?.blocks?.length === 5);
  await lead.call('POST', '/api/admin/content', { key: KEY, content: { blocks } });
  t.ok('saving the same content adds no version', (await lead.call('GET', `/api/admin/content/history?${Q}`)).j.versions.length === 1);

  // on the page: top, after a section, bottom, in that order
  await new Promise((r) => setTimeout(r, 1500));
  const html = await (await fetch(`${BASE}/`)).text();
  const at = (s) => html.indexOf(s);
  t.ok('the top block is on the home page', at('ZZ TOP BLOCK') > -1);
  t.ok(
    'in order: top, after events, bottom',
    at('ZZ TOP BLOCK') < at('ZZ AFTER EVENTS') && at('ZZ AFTER EVENTS') < at('ZZ BOTTOM BLOCK'),
    `${at('ZZ TOP BLOCK')} ${at('ZZ AFTER EVENTS')} ${at('ZZ BOTTOM BLOCK')}`,
  );
  t.ok(
    'the bottom is before the footer',
    at('ZZ BOTTOM BLOCK') < at('JOIN OUR DISCORD') || at('JOIN OUR DISCORD') === -1 || html.indexOf('Join our Discord') > at('ZZ BOTTOM BLOCK'),
  );
  t.ok('the dropped video is not there', !html.includes('evil.example'));
} finally {
  await svc.from('site_contents').delete().eq('key', KEY);
  await svc.from('site_content_versions').delete().eq('key', KEY);
  await svc.from('site_content_drafts').delete().eq('key', KEY);
  // the home page may have cached the blocks: save it empty once so a visitor never sees test text
  try {
    const clean = await accounts('stc2');
    const admin = await clean.user('a', ['ucsd', 'admin']);
    await admin.call('POST', '/api/admin/content', { key: KEY, content: { blocks: [] } });
    await svc.from('site_contents').delete().eq('key', KEY);
    await svc.from('site_content_versions').delete().eq('key', KEY);
    await clean.cleanup();
  } catch {}
  await svc.from('audit_log').delete().like('summary', '%builder.homepage%');
  await cleanup();
}
process.exit(t.result());
