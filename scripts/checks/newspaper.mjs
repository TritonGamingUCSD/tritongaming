// The Newspaper (issues of blocks, an audience picked by rules, a check by a second person, a test, then sending with results), end to end against a running dev server as temporary "ZZ" accounts.
// The dev server must run with EMAIL_DRY_RUN=1 (nothing is mailed; the send path is otherwise real). Audiences are always people picked by id (the ZZ accounts), never a role or everyone, so nobody real can be reached.
// Everything made is deleted at the end. Run: EMAIL_DRY_RUN=1 npm run dev  then  BASE_URL=http://localhost:3000 node scripts/checks/newspaper.mjs
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { accounts, svc, env, url, tracker, BASE } from './lib.mjs';

// the signed links the same way the site makes them (lib/email/unsubscribe.ts)
const secret = env.EMAIL_LINK_SECRET || env.SUPABASE_SERVICE_ROLE_KEY;
const signed = (id, kind) => {
  const body = Buffer.from(`${id}.${kind}`).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
};
const t = tracker();
const { user, cleanup, made: accountIds } = accounts('news');
const guests = [];
const nobody = async (method, path, body, redirect = 'follow') => {
  const r = await fetch(BASE + path, { method, redirect, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})), r };
};
try {
  const writer = await user('writer', ['officer']);
  const sender = await user('sender', ['exec']);
  const sender2 = await user('sender2', ['exec']);
  const member = await user('member', ['ucsd']);
  const p1 = await user('reader1', ['ucsd']);
  const p2 = await user('reader2', ['ucsd']);
  const p3 = await user('reader3', ['ucsd']);
  await svc.from('profiles').update({ email_newsletter: false }).eq('id', p3.id); // opted out of the Newsletter
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: anon } = await client.auth.signInAnonymously();
  guests.push(anon.user.id);
  const gcookie = `sb-${new URL(url).hostname.split('.')[0]}-auth-token=base64-${Buffer.from(JSON.stringify(anon.session)).toString('base64url')}`;
  const guestGet = (path) => fetch(BASE + path, { headers: { cookie: gcookie } }).then((r) => r.status);

  // ---- who can reach it
  t.ok('signed-out visitors are refused', (await nobody('GET', '/api/newspaper')).s === 401 && (await nobody('POST', '/api/newspaper', { title: 'ZZ x' })).s === 401);
  t.ok('a guest is refused', (await guestGet('/api/newspaper')) === 401);
  t.ok('an ordinary member is refused', (await member.call('GET', '/api/newspaper')).s === 403 && (await member.call('POST', '/api/newspaper', { title: 'ZZ x' })).s === 403);
  t.ok('an officer can write', (await writer.call('GET', '/api/newspaper')).s === 200);

  // ---- making and editing a draft
  t.ok('an event announcement needs an event', (await writer.call('POST', '/api/newspaper', { title: 'ZZ Ev', type: 'event_announcement' })).s === 400);
  t.ok('an event reminder needs an event too', (await writer.call('POST', '/api/newspaper', { title: 'ZZ Rem', type: 'event_reminder' })).s === 400);
  t.ok(
    'the issues about an event can be looked up by writers only',
    (await writer.call('GET', '/api/newspaper/event/00000000-0000-4000-8000-000000000000')).j.issues?.length === 0 &&
      (await member.call('GET', '/api/newspaper/event/00000000-0000-4000-8000-000000000000')).s === 403,
  );
  t.ok('a title is needed', (await writer.call('POST', '/api/newspaper', { title: '  ' })).s === 400);
  const mk = await writer.call('POST', '/api/newspaper', { title: 'ZZ News One' });
  t.ok('an officer makes a draft with the next number', mk.s === 201 && mk.j.issue.number > 0, JSON.stringify(mk.j));
  const slug = mk.j.issue.slug;
  const I = `/api/newspaper/${slug}`;
  const got = await writer.call('GET', I);
  t.ok(
    'it starts as a draft with a starting heading and text',
    got.j.issue.status === 'draft' && got.j.issue.blocks.length === 2 && got.j.problems.length === 0,
    JSON.stringify(got.j.problems),
  );
  const v0 = got.j.issue.content_version;
  const ed = await writer.call('PATCH', I, {
    title: 'ZZ News One <b>',
    blocks: [
      { type: 'heading', text: 'Hello', size: 'large' },
      { type: 'text', text: 'Read [our site](https://tritongaming.org/events?a=1&b=2) today.' },
      { type: 'button', label: 'Join', url: 'javascript:alert(1)' },
      { type: 'nonsense' },
    ],
    audience: { people: [p1.id, p2.id, p3.id], roles: ['wizard'] },
  });
  t.ok(
    'blocks are cleaned (an unsafe link and an unknown block are dropped) and the version goes up',
    ed.j.issue.blocks.length === 3 && ed.j.issue.blocks[2].url === '' && ed.j.issue.content_version > v0 && ed.j.issue.audience.roles.length === 0,
    JSON.stringify(ed.j.issue?.blocks),
  );
  t.ok(
    'the problems say the button is unfinished',
    (ed.j.problems ?? []).some((p) => /label and a link/.test(p)),
  );
  const pv = await writer.call('POST', `${I}/preview`, { title: 'ZZ Preview Title' });
  t.ok('the preview shows the draft’s words', pv.s === 200 && pv.j.html.includes('ZZ Preview Title') && pv.j.html.includes('Read <a'), pv.s);
  t.ok(
    'a member cannot read or preview or edit',
    (await member.call('GET', I)).s === 403 && (await member.call('POST', `${I}/preview`, {})).s === 403 && (await member.call('PATCH', I, { title: 'x' })).s === 403,
  );
  const fixed = await writer.call('PATCH', I, { blocks: [...ed.j.issue.blocks.slice(0, 2), { type: 'button', label: 'Join', url: 'https://tritongaming.org/join' }] });
  t.ok('fixing the button clears the problems', fixed.j.problems.length === 0);
  const v1 = fixed.j.issue.content_version;
  t.ok('the same words again do not change the version', (await writer.call('PATCH', I, { title: fixed.j.issue.title })).j.issue.content_version === v1);

  // ---- the audience
  const aud = await writer.call('POST', `${I}/audience`, {});
  t.ok('the audience counts people, skipping the one who opted out', aud.s === 200 && aud.j.total === 2 && aud.j.skippedOptOut === 1, JSON.stringify(aud.j));
  t.ok('the audience can be tried without saving', (await writer.call('POST', `${I}/audience`, { rules: { people: [p1.id], exclude: [p1.id] } })).j.total === 0);
  t.ok('a person can be left out', (await writer.call('POST', `${I}/audience`, { rules: { people: [p1.id, p2.id], exclude: [p2.id] } })).j.total === 1);
  const lst = await writer.call('POST', '/api/newspaper/lists', { name: 'ZZ News List', rules: { people: [p1.id] } });
  t.ok(
    'an audience can be saved, renamed and removed',
    lst.s === 201 &&
      (await writer.call('PATCH', `/api/newspaper/lists/${lst.j.list.id}`, { name: 'ZZ News List 2' })).j.list.name === 'ZZ News List 2' &&
      (await writer.call('GET', '/api/newspaper/lists')).j.lists.some((l) => l.id === lst.j.list.id),
  );
  t.ok('an empty audience is not saved', (await writer.call('POST', '/api/newspaper/lists', { name: 'ZZ empty', rules: {} })).s === 400);
  await writer.call('DELETE', `/api/newspaper/lists/${lst.j.list.id}`);
  t.ok('a member cannot use the saved audiences', (await member.call('GET', '/api/newspaper/lists')).s === 403);

  // ---- the check by a second person
  t.ok('a member cannot ask for a check', (await member.call('PATCH', I, { action: 'request_review' })).s === 403);
  const empty = await writer.call('POST', '/api/newspaper', { title: 'ZZ News Empty' });
  await writer.call('PATCH', `/api/newspaper/${empty.j.issue.slug}`, { audience: {} });
  t.ok('an issue with no audience cannot be sent for checking', (await writer.call('PATCH', `/api/newspaper/${empty.j.issue.slug}`, { action: 'request_review' })).s === 409);
  await writer.call('DELETE', `/api/newspaper/${empty.j.issue.slug}`);
  const rv = await writer.call('PATCH', I, { action: 'request_review' });
  t.ok('the writer asks for a check', rv.s === 200 && rv.j.issue.status === 'review' && rv.j.issue.review_by === writer.id, JSON.stringify(rv.j));
  t.ok('an issue under review cannot be edited', (await writer.call('PATCH', I, { title: 'ZZ changed' })).s === 409);
  t.ok('a writer cannot send it', (await writer.call('POST', `${I}/send`, { action: 'start' })).s === 403);
  t.ok('a sender must send a test of this version first', (await sender.call('POST', `${I}/send`, { action: 'start' })).j.needsTest === true);
  t.ok(
    'a sender sends it back with a note, and it becomes a draft again',
    (await sender.call('PATCH', I, { action: 'send_back', comment: 'ZZ please fix the title' })).j.issue.status === 'draft' &&
      (await writer.call('GET', I)).j.comments.some((c) => /fix the title/.test(c.body)),
  );
  await writer.call('PATCH', I, { action: 'request_review' });
  t.ok('the writer can take it back while it waits', (await writer.call('PATCH', I, { action: 'withdraw' })).j.issue.status === 'draft');
  await writer.call('PATCH', I, { action: 'request_review' });
  t.ok('a note can be added', (await sender.call('POST', `${I}/comments`, { body: 'ZZ looks good' })).j.comments.length === 2);

  // ---- a test, then sending
  const test = await writer.call('POST', `${I}/test`, { to: 'zz.tester@example.test' });
  t.ok('a test goes to you and the address you gave, and counts as tested', test.s === 200 && test.j.sent >= 1 && test.j.tested === true, JSON.stringify(test.j));
  t.ok('the test counts for this version of the issue', (await writer.call('GET', I)).j.issue.tested_version === (await writer.call('GET', I)).j.issue.content_version);
  t.ok('the writer still cannot send their own issue', (await writer.call('POST', `${I}/send`, { action: 'start' })).s === 403);
  const st = await sender.call('POST', `${I}/send`, { action: 'start' });
  t.ok(
    'another sender starts it, and the people are written down (not the opted-out one)',
    st.s === 200 && st.j.issue.status === 'sending' && st.j.results.total === 2 && st.j.results.pending === 2,
    JSON.stringify(st.j.results),
  );
  t.ok('it cannot be started twice', (await sender.call('POST', `${I}/send`, { action: 'start' })).s === 409);
  t.ok('the links are numbered', st.j.results.links.length === 2 && st.j.results.links.every((l) => /^https?:/.test(l.url)), JSON.stringify(st.j.results.links));
  const [a, b2] = await Promise.all([sender.call('POST', `${I}/send`, { action: 'batch' }), sender2.call('POST', `${I}/send`, { action: 'batch' })]);
  const fin = await sender.call('POST', `${I}/send`, { action: 'batch' });
  const { data: rows } = await svc.from('newspaper_deliveries').select('email, status').eq('issue_id', st.j.issue.id);
  t.ok(
    'two pages sending at once send each person exactly once',
    (rows ?? []).length === 2 && (rows ?? []).every((r) => r.status === 'sent') && fin.j.done === true,
    JSON.stringify([a.j.results, b2.j.results, rows]),
  );
  t.ok('the issue is sent, with its results', fin.j.issue.status === 'sent' && fin.j.results.sent === 2 && fin.j.results.failed === 0 && !!fin.j.issue.sent_at);
  t.ok('a writer sees the counts but not the failed people', (await writer.call('GET', I)).j.results.failures.length === 0);
  t.ok(
    'an issue that has gone out cannot be edited, retried or deleted',
    (await writer.call('PATCH', I, { title: 'x' })).s === 409 &&
      (await sender.call('POST', `${I}/send`, { action: 'retry' })).s === 409 &&
      (await writer.call('DELETE', I)).s === 409,
  );

  // ---- clicks and the web copy
  const tok = fin.j.issue.web_token;
  const click = await fetch(`${BASE}/api/newspaper/click/${tok}/1`, { redirect: 'manual' });
  t.ok('a click is counted and goes on to the link', click.status === 302 && /^https?:/.test(click.headers.get('location') ?? ''), click.status);
  await fetch(`${BASE}/api/newspaper/click/${tok}/1`, { redirect: 'manual' });
  const { data: lk } = await svc.from('newspaper_links').select('n, clicks').eq('issue_id', st.j.issue.id).eq('n', 1).single();
  t.ok('clicks add up per link', lk.clicks === 2, JSON.stringify(lk));
  t.ok('a made-up click address goes to the home page, not an error', (await fetch(`${BASE}/api/newspaper/click/${'0'.repeat(32)}/1`, { redirect: 'manual' })).status === 302);
  const web = await fetch(`${BASE}/newspaper/${tok}`);
  const webText = await web.text();
  t.ok(
    'the web copy opens without signing in, and is kept out of search engines',
    web.status === 200 && webText.includes('ZZ News One') && (web.headers.get('x-robots-tag') ?? '').includes('noindex'),
  );
  t.ok('the web copy has nobody’s unsubscribe link', !/api\/email\/unsubscribe/.test(webText));
  t.ok('a made-up web address is a 404', (await fetch(`${BASE}/newspaper/${'1'.repeat(32)}`)).status === 404);
  const draft2 = await writer.call('POST', '/api/newspaper', { title: 'ZZ News Draft' });
  const { data: d2 } = await svc.from('newspaper_issues').select('web_token').eq('slug', draft2.j.issue.slug).single();
  t.ok('a draft has no web copy', (await fetch(`${BASE}/newspaper/${d2.web_token}`)).status === 404);
  t.ok('a draft can be deleted by its writer', (await writer.call('DELETE', `/api/newspaper/${draft2.j.issue.slug}`)).s === 200);

  // ---- a failure and its retry
  const f = await writer.call('POST', '/api/newspaper', { title: 'ZZ News Fail', copy_from: st.j.issue.id });
  t.ok(
    'an issue can be copied (blocks and audience come along)',
    f.s === 201 && (await writer.call('GET', `/api/newspaper/${f.j.issue.slug}`)).j.issue.audience.people.length === 3,
  );
  const FS = `/api/newspaper/${f.j.issue.slug}`;
  await writer.call('PATCH', FS, { action: 'request_review' });
  await writer.call('POST', `${FS}/test`, {});
  t.ok(
    'the second sender cannot send an issue they wrote themselves',
    await (async () => {
      const own = await sender2.call('POST', '/api/newspaper', { title: 'ZZ News Own', copy_from: st.j.issue.id });
      const O = `/api/newspaper/${own.j.issue.slug}`;
      await sender2.call('PATCH', O, { action: 'request_review' });
      await sender2.call('POST', `${O}/test`, {});
      return (await sender2.call('POST', `${O}/send`, { action: 'start' })).s === 403;
    })(),
  );
  const fst = await sender.call('POST', `${FS}/send`, { action: 'start' });
  await sender.call('POST', `${FS}/send`, { action: 'batch' });
  const { data: one } = await svc.from('newspaper_deliveries').select('id').eq('issue_id', fst.j.issue.id).limit(1);
  await svc.from('newspaper_deliveries').update({ status: 'failed', error: 'ZZ Gmail refused that address.' }).eq('id', one[0].id);
  const afterFail = await sender.call('GET', FS);
  t.ok('a sender sees who failed and why', afterFail.j.results.failed === 1 && afterFail.j.results.failures[0].error.includes('refused'), JSON.stringify(afterFail.j.results));
  t.ok('a writer does not see the failed people', (await writer.call('GET', FS)).j.results.failures.length === 0);
  const rt = await sender.call('POST', `${FS}/send`, { action: 'retry' });
  t.ok('retry puts the failed one back', rt.j.issue.status === 'sending' && rt.j.results.pending === 1);
  const rd = await sender.call('POST', `${FS}/send`, { action: 'batch' });
  t.ok('and sends it', rd.j.done === true && rd.j.results.failed === 0 && rd.j.issue.status === 'sent');

  // ---- the public pieces are not leaked
  const { data: audit } = await svc.from('audit_log').select('summary').like('summary', '%ZZ News%').limit(20);
  t.ok(
    'making, checking and sending are in the Audit Log',
    (audit ?? []).some((a) => /Started sending/.test(a.summary)) && (audit ?? []).some((a) => /Asked for a check/.test(a.summary)),
  );

  // ---- public subscribers
  const E1 = 'zz-news-sub1@example.test';
  t.ok(
    'a robot filling the hidden field is told it worked and nothing is saved',
    (await nobody('POST', '/api/newspaper/subscribe', { email: 'zz-news-bot@example.test', website: 'http://spam' })).s === 200 &&
      ((await svc.from('newspaper_subscribers').select('id').eq('email', 'zz-news-bot@example.test')).data ?? []).length === 0,
  );
  t.ok('a bad address is refused', (await nobody('POST', '/api/newspaper/subscribe', { email: 'not an email' })).s === 400);
  const s1 = await nobody('POST', '/api/newspaper/subscribe', { email: ' ZZ-News-Sub1@Example.test ', name: 'Zed' });
  const { data: row1 } = await svc.from('newspaper_subscribers').select('id, status, name, email').eq('email', E1).maybeSingle();
  t.ok('signing up saves a pending subscriber (not yet added)', s1.s === 200 && row1?.status === 'pending' && row1.name === 'Zed', JSON.stringify([s1.s, s1.j, row1]));
  t.ok(
    'signing up again at once gives the same answer and no second row',
    (await nobody('POST', '/api/newspaper/subscribe', { email: E1 })).s === 200 && ((await svc.from('newspaper_subscribers').select('id').eq('email', E1)).data ?? []).length === 1,
  );
  t.ok('a made-up confirm link is refused', (await nobody('POST', '/api/newspaper/confirm', { t: 'abc.def' })).s === 400);
  t.ok('an opt-out link cannot be used to confirm', (await nobody('POST', '/api/newspaper/confirm', { t: signed(row1.id, 'newsletter') })).s === 400);
  t.ok(
    'the confirm link adds the subscriber',
    (await nobody('POST', '/api/newspaper/confirm', { t: signed(row1.id, 'confirm') })).s === 200 &&
      (await svc.from('newspaper_subscribers').select('status').eq('id', row1.id).single()).data.status === 'active',
  );
  t.ok(
    'a subscriber who is already in gets the same answer and stays in',
    (await nobody('POST', '/api/newspaper/subscribe', { email: E1 })).s === 200 &&
      (await svc.from('newspaper_subscribers').select('status').eq('id', row1.id).single()).data.status === 'active',
  );
  t.ok(
    'only senders see the subscribers',
    (await writer.call('GET', '/api/newspaper/subscribers')).s === 403 &&
      (await member.call('GET', '/api/newspaper/subscribers')).s === 403 &&
      (await nobody('GET', '/api/newspaper/subscribers')).s === 401,
  );
  const list = await sender.call('GET', '/api/newspaper/subscribers?q=zz-news-sub1');
  t.ok('a sender sees them, with counts and a search', list.s === 200 && list.j.subscribers.length === 1 && list.j.active >= 1, JSON.stringify(list.j));
  t.ok(
    'an opt-out link from an email (the same link as members use) takes a subscriber off',
    (await nobody('POST', `/api/email/unsubscribe?t=${signed(row1.id, 'newsletter')}`)).s === 200 &&
      (await svc.from('newspaper_subscribers').select('status').eq('id', row1.id).single()).data.status === 'unsubscribed',
  );
  t.ok(
    'an unsubscribed address can sign up again (and must confirm again)',
    (await nobody('POST', '/api/newspaper/subscribe', { email: E1 })).s === 200 &&
      (await svc.from('newspaper_subscribers').select('status').eq('id', row1.id).single()).data.status === 'pending',
  );
  t.ok(
    'a writer cannot remove a subscriber; a sender can',
    (await writer.call('DELETE', `/api/newspaper/subscribers/${row1.id}`)).s === 403 &&
      (await sender.call('DELETE', `/api/newspaper/subscribers/${row1.id}`)).s === 200 &&
      ((await svc.from('newspaper_subscribers').select('id').eq('id', row1.id)).data ?? []).length === 0,
  );
  t.ok('the sign-up page and confirm page open for anyone', (await fetch(`${BASE}/newspaper`)).status === 200 && (await fetch(`${BASE}/newspaper/confirm?t=bad`)).status === 200);
} catch (e) {
  console.log('ERR', String(e).slice(0, 700));
  t.fail();
} finally {
  await svc.from('newspaper_issues').delete().like('title', 'ZZ News%');
  await svc.from('newspaper_lists').delete().like('name', 'ZZ News%');
  await svc.from('newspaper_subscribers').delete().like('email', 'zz-news-%@example.test');
  await svc
    .from('audit_log')
    .delete()
    .in('actor_id', accountIds ?? []);
  for (const id of guests) await svc.auth.admin.deleteUser(id).catch(() => undefined);
  await cleanup();
  const left = await svc.from('newspaper_issues').select('id').like('title', 'ZZ News%');
  console.log('left issues', left.data?.length ?? '?');
  process.exit(t.result());
}
