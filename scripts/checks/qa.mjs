// Q&A (a live question wall, asked into with a 6-digit code), end to end against a running dev server as temporary "ZZ" accounts, with the permissions checked for every kind of visitor.
// Everything made is deleted at the end (sessions, their questions and likes go with them).
// Run: BASE_URL=http://localhost:3000 node scripts/checks/qa.mjs
import { createClient } from '@supabase/supabase-js';
import { accounts, svc, env, url, tracker, BASE } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('qa');
const made = [];
const guests = [];
const guestUser = async () => {
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw new Error(`anonymous sign-in is off or failed: ${error.message}`);
  const ref = new URL(url).hostname.split('.')[0];
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64url')}`;
  guests.push(data.user.id);
  const call = async (method, path, body) => {
    const r = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { s: r.status, j: await r.json().catch(() => ({})) };
  };
  return { id: data.user.id, call };
};
const nobody = async (method, path, body) => {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
try {
  const host = await user('host', ['officer']);
  const member = await user('member', ['ucsd']);
  const g1 = await guestUser();
  const g2 = await guestUser();
  const g3 = await guestUser();

  // ---- who may make and run a Q&A
  t.ok('signed-out visitors cannot list or make a Q&A', (await nobody('GET', '/api/qa')).s === 401 && (await nobody('POST', '/api/qa', { name: 'ZZ no' })).s === 401);
  t.ok('an ordinary member cannot list or make a Q&A', (await member.call('GET', '/api/qa')).s === 403 && (await member.call('POST', '/api/qa', { name: 'ZZ no' })).s === 403);
  t.ok('a guest cannot list or make a Q&A', (await g1.call('GET', '/api/qa')).s === 401 && (await g1.call('POST', '/api/qa', { name: 'ZZ no' })).s === 401);
  t.ok('a blank name is refused', (await host.call('POST', '/api/qa', { name: '   ' })).s === 400);
  const mk = await host.call('POST', '/api/qa', { name: 'ZZ QA Panel' });
  t.ok('an officer makes a Q&A (a draft, no code yet)', mk.s === 201 && mk.j.session?.status === 'draft' && mk.j.session?.code === null, JSON.stringify(mk.j));
  const S = `/api/qa/${mk.j.session.slug}`;
  const id = mk.j.session.id;
  made.push(id);
  t.ok(
    'an ordinary member and a guest cannot see or change it',
    (await member.call('GET', S)).s === 403 &&
      (await member.call('PATCH', S, { action: 'open' })).s === 403 &&
      (await member.call('DELETE', S)).s === 403 &&
      (await g1.call('GET', S)).s === 401 &&
      (await g1.call('PATCH', S, { action: 'open' })).s === 401,
  );

  // ---- nobody can ask before it is open
  t.ok(
    'a draft is invisible to guests',
    (await g1.call('GET', `/api/qa/play/${id}`)).s === 404 && (await g1.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ early' })).s === 404,
  );

  // ---- open
  const op = await host.call('PATCH', S, { action: 'open' });
  const CODE = op.j.session?.code;
  t.ok('opening gives a 6-digit code', op.s === 200 && /^[0-9]{6}$/.test(CODE) && op.j.session.status === 'open', JSON.stringify(op.j.session));
  t.ok(
    'the code is looked up without signing in, as a Q&A, and says nothing more',
    (await nobody('GET', `/api/polls/lookup/${CODE}`)).j.kind === 'qa' && !JSON.stringify((await nobody('GET', `/api/polls/lookup/${CODE}`)).j).includes(id),
  );
  t.ok(
    'the portal code box finds it (a member, then a guest)',
    (await member.call('POST', '/api/polls/join', { code: CODE })).s === 200 && (await g1.call('POST', '/api/polls/join', { code: CODE })).s === 200,
  );
  t.ok('a guest can follow it by its code', (await g1.call('GET', `/api/qa/play/${CODE}`)).s === 200);

  // ---- asking
  t.ok('an empty question is refused', (await g1.call('POST', `/api/qa/play/${id}/ask`, { body: '   ' })).s === 400);
  const a1 = await g1.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ  Will   there be a sequel?', author: 'Sam' });
  const a2 = await g2.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ Anonymous one' });
  const a3 = await g3.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ Rude one' });
  t.ok('guests send questions (they wait for the host)', a1.s === 201 && a2.s === 201 && a3.s === 201 && a1.j.question.status === 'pending', JSON.stringify(a1.j));
  const seen = await g2.call('GET', `/api/qa/play/${id}`);
  t.ok('a waiting question is not shown to other guests', seen.j.questions.length === 0 && seen.j.mine.length === 1 && seen.j.mine[0].status === 'pending', JSON.stringify(seen.j));
  const view = await host.call('GET', S);
  const byBody = (b) => view.j.questions.find((q) => q.body.includes(b));
  t.ok('the host sees all three, with the spaces tidied', view.j.questions.length === 3 && byBody('Will there be a sequel?'), JSON.stringify(view.j.questions.map((q) => q.body)));
  const q1 = byBody('sequel').id,
    q2 = byBody('Anonymous').id,
    q3 = byBody('Rude').id;

  // ---- limits
  const g4 = await guestUser();
  for (const n of [1, 2, 3]) await g4.call('POST', `/api/qa/play/${id}/ask`, { body: `ZZ flood ${n}` });
  t.ok('a person can have only 3 questions waiting', (await g4.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ flood 4' })).s === 429);
  const longQ = await g3.call('POST', `/api/qa/play/${id}/ask`, { body: 'x'.repeat(500) });
  t.ok('a long question is cut to 280 characters', longQ.s === 201 && longQ.j.question.body.length === 280);

  // ---- approving
  t.ok('an ordinary member cannot approve', (await member.call('PATCH', `${S}/questions/${q1}`, { status: 'approved' })).s === 403);
  t.ok('a guest cannot approve', (await g1.call('PATCH', `${S}/questions/${q1}`, { status: 'approved' })).s === 401);
  t.ok('a question that is not approved cannot go on the screen', (await host.call('PATCH', `${S}/questions/${q1}`, { spotlight: true })).s === 409);
  t.ok('a bad state is refused', (await host.call('PATCH', `${S}/questions/${q1}`, { status: 'nope' })).s === 400);
  await host.call('PATCH', `${S}/questions/${q3}`, { status: 'hidden' });
  const ap = await host.call('PATCH', S, { action: 'approve_all' });
  t.ok(
    'approve all shows every waiting one but not the hidden one',
    ap.j.questions.filter((q) => q.status === 'approved').length >= 2 && ap.j.questions.find((q) => q.id === q3).status === 'hidden',
  );
  const g = await g3.call('GET', `/api/qa/play/${id}`);
  t.ok(
    'guests now see the approved ones and never the hidden one',
    g.j.questions.some((q) => q.id === q1) && !g.j.questions.some((q) => q.id === q3),
    JSON.stringify(g.j.questions.map((q) => q.id)),
  );
  t.ok(
    'the asker sees what became of their own question',
    (await g3.call('GET', `/api/qa/play/${id}`)).j.mine.some((q) => q.id === q3 && q.status === 'hidden'),
  );

  // ---- likes
  t.ok('a guest likes a question', (await g2.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: true })).s === 200);
  await g2.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: true }); // twice is still one
  await g3.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: true });
  await g1.call('POST', `/api/qa/play/${id}/like`, { question_id: q2, on: true });
  const liked = (await g2.call('GET', `/api/qa/play/${id}`)).j.questions;
  t.ok(
    'likes are counted once each and ranked first',
    liked[0].id === q1 && liked[0].likes === 2 && liked[0].liked === true && liked.find((q) => q.id === q2).likes === 1,
    JSON.stringify(liked.map((q) => [q.id === q1 ? 'q1' : 'q2', q.likes])),
  );
  t.ok(
    'a like can be taken back',
    (await g3.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: false })).s === 200 && (await g2.call('GET', `/api/qa/play/${id}`)).j.questions[0].likes === 1,
  );
  t.ok('a hidden question cannot be liked', (await g1.call('POST', `/api/qa/play/${id}/like`, { question_id: q3, on: true })).s === 404);
  await g3.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: true });

  // ---- the screen
  const sp = await host.call('PATCH', `${S}/questions/${q1}`, { spotlight: true });
  t.ok('the host puts a question on the screen', sp.j.session.spotlight_id === q1 && (await g1.call('GET', `/api/qa/play/${id}`)).j.spotlight_id === q1);
  const nx = await host.call('PATCH', S, { action: 'next' });
  t.ok(
    'Answered · Next marks it answered and puts up the next most liked',
    nx.j.questions.find((q) => q.id === q1).status === 'answered' && nx.j.session.spotlight_id === q2,
    JSON.stringify(nx.j.session),
  );
  t.ok('hiding the shown question takes it off the screen', (await host.call('PATCH', `${S}/questions/${q2}`, { status: 'hidden' })).j.session.spotlight_id === null);
  t.ok('Answered · Next goes on to the next most liked one', !!(await host.call('PATCH', S, { action: 'next' })).j.session.spotlight_id);
  t.ok('Clear Screen empties the screen', (await host.call('PATCH', S, { action: 'clear_screen' })).j.session.spotlight_id === null);

  // ---- closing
  t.ok('an ordinary member cannot close it', (await member.call('PATCH', S, { action: 'close' })).s === 403);
  t.ok('the host closes it', (await host.call('PATCH', S, { action: 'close' })).j.session.status === 'closed');
  t.ok(
    'a closed Q&A takes no questions or likes',
    (await g1.call('POST', `/api/qa/play/${id}/ask`, { body: 'ZZ late' })).s === 409 && (await g1.call('POST', `/api/qa/play/${id}/like`, { question_id: q1, on: true })).s === 409,
  );
  t.ok(
    'a closed Q&A can still be read, and says it is closed on the code box',
    (await g1.call('GET', `/api/qa/play/${CODE}`)).j.session?.status === 'closed' && (await g1.call('POST', '/api/polls/join', { code: CODE })).s === 409,
  );
  t.ok('it can be opened again with the same code', (await host.call('PATCH', S, { action: 'reopen' })).j.session.code === CODE);
  t.ok('an open Q&A cannot be deleted', (await host.call('DELETE', S)).s === 409);
  await host.call('PATCH', S, { action: 'close' });

  // ---- deleting
  t.ok('an ordinary member cannot delete a question or the Q&A', (await member.call('DELETE', `${S}/questions/${q3}`)).s === 403 && (await member.call('DELETE', S)).s === 403);
  t.ok(
    'the host deletes a question',
    (await host.call('DELETE', `${S}/questions/${q3}`)).j.questions.every((q) => q.id !== q3),
  );
  t.ok('the host deletes the Q&A', (await host.call('DELETE', S)).s === 200);
  const { data: left } = await svc.from('qa_sessions').select('id').eq('id', id);
  const { data: qs } = await svc.from('qa_questions').select('id').eq('session_id', id);
  t.ok('the Q&A and its questions are gone', (left ?? []).length === 0 && (qs ?? []).length === 0);
} catch (e) {
  console.log('ERR', String(e).slice(0, 600));
  t.fail();
} finally {
  if (made.length) await svc.from('qa_sessions').delete().in('id', made);
  for (const id of guests) await svc.auth.admin.deleteUser(id).catch(() => undefined);
  await cleanup();
  const left = await svc.from('qa_sessions').select('id').like('name', 'ZZ QA%');
  console.log('left sessions', left.data?.length ?? '?');
  process.exit(t.result());
}
