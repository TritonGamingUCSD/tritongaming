// The Dashboard's Today cards (/api/portal/today): each part appears only for the people who may see it. End to end against a running dev server as temporary "ZZ" accounts.
// Run: BASE_URL=http://localhost:3000 node scripts/checks/today.mjs
import { accounts, svc, tracker, BASE } from './lib.mjs';

const t = tracker();
const { user, cleanup, made } = accounts('today');
try {
  const writer = await user('writer', ['officer']);
  const sender = await user('sender', ['exec']);
  const member = await user('member', ['ucsd']);
  const get = (who) => who.call('GET', '/api/portal/today');

  t.ok('signed-out visitors get nothing', (await fetch(`${BASE}/api/portal/today`).then((r) => r.json())).newsletter === null);
  const quiet = await get(member);
  t.ok('an ordinary member has no Newsletter or Q&A cards', quiet.s === 200 && quiet.j.newsletter === null && quiet.j.qa.length === 0 && Array.isArray(quiet.j.meetings));

  // a Newsletter issue waiting for a check
  const mk = await writer.call('POST', '/api/newsletter', { title: 'ZZ Today Issue' });
  await writer.call('PATCH', `/api/newsletter/${mk.j.issue.slug}`, { action: 'request_review' });
  const w = await get(writer);
  t.ok('the writer sees their own issue is with a sender (not waiting for them)', w.j.newsletter?.mine === 1 && w.j.newsletter.waiting === 0, JSON.stringify(w.j.newsletter));
  const s = await get(sender);
  t.ok('a sender sees it waiting for their check, with a link to it', s.j.newsletter?.waiting >= 1 && typeof s.j.newsletter.first === 'string', JSON.stringify(s.j.newsletter));
  t.ok('the member still sees none', (await get(member)).j.newsletter === null);

  // a Q&A with a question waiting
  const qa = await sender.call('POST', '/api/qa', { name: 'ZZ Today QA' });
  await sender.call('PATCH', `/api/qa/${qa.j.session.slug}`, { action: 'open' });
  await svc.from('qa_questions').insert({ session_id: qa.j.session.id, body: 'ZZ waiting question', user_id: null });
  const h = await get(sender);
  t.ok(
    'a host sees the open Q&A with a question waiting',
    h.j.qa.some((x) => x.name === 'ZZ Today QA' && x.pending === 1),
    JSON.stringify(h.j.qa),
  );
  t.ok('an ordinary member does not', (await get(member)).j.qa.length === 0);
  await svc.from('qa_questions').update({ status: 'approved' }).eq('session_id', qa.j.session.id);
  t.ok('once approved it is no longer waiting', !(await get(sender)).j.qa.some((x) => x.name === 'ZZ Today QA'));
} catch (e) {
  console.log('ERR', String(e).slice(0, 500));
  t.fail();
} finally {
  await svc.from('newsletter_issues').delete().like('title', 'ZZ Today%');
  await svc.from('qa_sessions').delete().like('name', 'ZZ Today%');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ Today%');
  await svc.from('notifications').delete().or('title.ilike.%ZZ%,body.ilike.%ZZ%');
  await cleanup();
  process.exit(t.result());
}
