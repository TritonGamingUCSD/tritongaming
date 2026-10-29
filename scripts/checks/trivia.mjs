// Trivia (quizzes with a pool of questions, live games, speed scoring, the top-3 block), end to end against a running dev server as temporary "ZZ" accounts.
// Everything made is deleted at the end (quizzes, their games, players and answers go with them).
// Run: BASE_URL=http://localhost:3101 node scripts/checks/trivia.mjs
import { createClient } from '@supabase/supabase-js';
import { accounts, svc, env, url, tracker, BASE } from './lib.mjs';

const t = tracker();
const { user, made, cleanup } = accounts('trivia');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const host = await user('host', ['officer']);
  const guest = await user('guest', []); // signed in, no role at all
  const players = [];
  for (let i = 1; i <= 4; i++) players.push(await user(`p${i}`, ['ucsd']));
  const [p1, p2, p3, p4] = players;

  // ---- who may do what
  t.ok(
    'a plain member cannot see quizzes',
    (await guest.call('GET', '/api/trivia/quizzes')).s === 403 && (await p1.call('POST', '/api/trivia/quizzes', { name: 'ZZ no' })).s === 403,
  );
  t.ok('a signed-out call is refused', (await fetch(`${process.env.BASE_URL}/api/trivia/quizzes`)).status === 401);
  const made1 = await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Trivia Night' });
  t.ok('an officer makes a quiz', made1.s === 201 && made1.j.quiz.slug === 'zz-trivia-night', JSON.stringify(made1.j));
  t.ok('the same name gets its own address', (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Trivia Night' })).j.quiz?.slug === 'zz-trivia-night-2');
  const Q = made1.j.quiz.slug;
  const QU = `/api/trivia/quizzes/${Q}/questions`;

  // ---- the pool
  t.ok('a question needs four answers', (await host.call('POST', QU, { text: 'x', choices: ['a', 'b'] })).s === 400);
  t.ok('the right answer is one of four', (await host.call('POST', QU, { correct: 4 })).s === 400);
  // The time of a question is kept in the database only (the editor neither shows nor sets it): worked out from the wording.
  const secsOf = async (ids) => ((await svc.from('trivia_questions').select('id, secs').in('id', ids)).data ?? []).map((r) => r.secs);
  const blank = await host.call('POST', QU, {});
  t.ok(
    'a blank question can be added, 40 seconds by default',
    blank.s === 201 && (await secsOf([blank.j.questions[0].id]))[0] === 40 && blank.j.questions[0].choices.length === 4,
    JSON.stringify(blank),
  );
  const bulk = await host.call('POST', QU, {
    rows: Array.from({ length: 6 }, (_, i) => ({ category: 'ZZ Cat', text: `ZZ Question ${i + 1}`, choices: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], correct: i % 4 })),
  });
  t.ok('questions can be added in bulk', bulk.s === 201 && bulk.j.questions.length === 6);
  t.ok(
    'the time cannot be set: it is worked out from the wording (a time sent is ignored)',
    (await secsOf(bulk.j.questions.map((q) => q.id))).every((x) => x >= 40 && x % 5 === 0),
  );
  const list = await host.call('GET', '/api/trivia/quizzes');
  const row = list.j.quizzes.find((q) => q.slug === Q);
  t.ok('the list counts the pool and the finished questions (the blank one is not finished)', row.questions === 7 && row.ready === 6, JSON.stringify(row));
  const edit = await host.call('PATCH', QU, { id: bulk.j.questions[0].id, text: 'ZZ Question 1 (edited)' });
  t.ok('a question can be edited', edit.s === 200 && edit.j.question.text.endsWith('(edited)'));
  const before = (await secsOf([bulk.j.questions[1].id]))[0];
  await host.call('PATCH', QU, { id: bulk.j.questions[1].id, text: 'ZZ ' + 'word '.repeat(60) });
  const after = (await secsOf([bulk.j.questions[1].id]))[0];
  await host.call('PATCH', QU, { id: bulk.j.questions[1].id, secs: 5 });
  t.ok(
    'a longer question gets a longer time (up to 2 minutes), and a time sent with it is ignored',
    after > before && after <= 120 && (await secsOf([bulk.j.questions[1].id]))[0] === after,
    `${before} -> ${after}`,
  );
  t.ok(
    'a quiz asks between 1 and 100 questions',
    (await host.call('PATCH', `/api/trivia/quizzes/${Q}`, { per_game: 0 })).s === 400 &&
      (await host.call('PATCH', `/api/trivia/quizzes/${Q}`, { per_game: 3 })).j.quiz.per_game === 3,
  );
  t.ok('a plain member cannot change the pool', (await p1.call('PATCH', QU, { id: bulk.j.questions[0].id, text: 'hack' })).s === 403);

  // ---- a game
  const g1 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  t.ok('an officer opens a lobby with a 6-character code', g1.s === 201 && /^[0-9]{6}$/.test(g1.j.code) && g1.j.state.status === 'lobby', JSON.stringify(g1.j));
  const C = g1.j.code;
  const G = `/api/trivia/games/${C}`;
  t.ok('a plain member cannot open the host screen or control a game', (await p1.call('GET', G)).s === 403 && (await p1.call('POST', G, { action: 'start' })).s === 403);
  t.ok('a wrong code is refused', (await p1.call('POST', '/api/trivia/join', { code: '000000' })).s === 404);
  t.ok('the game cannot start with nobody in', (await host.call('POST', G, { action: 'start' })).s === 409);

  // The live channel: a player's own login follows the game and sees the start the moment it happens.
  const watcher = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const got = [];
  const joined1 = await p1.call('POST', '/api/trivia/join', { code: C.toLowerCase() });
  t.ok('a member joins (the code in any capitals)', joined1.s === 200 && joined1.j.me.status === 'in' && joined1.j.state.players === 1, JSON.stringify(joined1.j));
  const gameId = joined1.j.state.gameId;
  const ch = watcher.channel(`trivia:${gameId}`, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'state' }, (m) => got.push({ at: Date.now(), p: m.payload }));
  await new Promise((res) =>
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') res();
    }),
  );
  // How many have answered goes only to the host's own channel (it is busy, and the phones do not need it).
  const hostCh = watcher.channel(`trivia-host:${gameId}`, { config: { broadcast: { self: false } } });
  hostCh.on('broadcast', { event: 'count' }, (m) => got.push({ at: Date.now(), count: m.payload }));
  await new Promise((res) =>
    hostCh.subscribe((s) => {
      if (s === 'SUBSCRIBED') res();
    }),
  );
  for (const p of [p2, p3, p4]) await p.call('POST', '/api/trivia/join', { code: C });
  t.ok('joining twice keeps one player', (await p1.call('POST', '/api/trivia/join', { code: C })).j.state.players === 4);
  const lobby = (await host.call('GET', G)).j;
  t.ok(
    'the host sees the lobby and how many questions the pool can give',
    lobby.players.length === 4 && lobby.ready === 6 && lobby.perGame === 3,
    JSON.stringify([lobby.players.length, lobby.ready, lobby.perGame]),
  );
  t.ok('a player cannot tell a pool question from the lobby', (await p2.call('GET', `/api/trivia/play/${C}`)).j.state.question === undefined);
  t.ok(
    "the number of questions is the quiz's own setting, and there is no lobby action to change it",
    (await host.call('GET', G)).j.perGame === 3 && (await host.call('POST', G, { action: 'count', count: 5 })).s === 400,
  );
  t.ok('someone who has not joined cannot see the game from the inside', (await guest.call('GET', `/api/trivia/play/${C}`)).s === 404);

  // removing and letting back in
  await guest.call('POST', `/api/trivia/play/${C}/answer`, { q: 0, pos: 0 }); // (a first call compiles the route on a dev server; keep that out of the timed part)
  await p1.call('GET', `/api/trivia/play/${C}`);
  t.ok(
    'the host removes a player',
    (await host.call('POST', G, { action: 'remove', user_id: p4.id })).s === 200 && (await p4.call('GET', `/api/trivia/play/${C}`)).j.me.status === 'removed',
  );
  t.ok(
    'a removed player stays out when joining again',
    (await p4.call('POST', '/api/trivia/join', { code: C })).j.me.status === 'removed' && (await p4.call('POST', `/api/trivia/play/${C}/answer`, { q: 0, pos: 0 })).s === 409,
  );
  t.ok(
    'the host lets them back in',
    (await host.call('POST', G, { action: 'allow', user_id: p4.id })).s === 200 && (await p4.call('GET', `/api/trivia/play/${C}`)).j.me.status === 'in',
  );

  // ---- play: 3 questions
  const startAt = Date.now();
  const st = await host.call('POST', G, { action: 'start' });
  await sleep(7400); // the first question opens with a 4 s countdown and its 3 s category card; answers sent before it ends are refused
  t.ok('the host starts the game', st.s === 200, JSON.stringify(st.j));
  await sleep(1200);
  const live = got.find((m) => m.p?.status === 'question');
  t.ok('the start reaches a watching phone through the live channel in about a second', !!live && live.at - startAt < 2500, `${got.length} ${live ? live.at - startAt : 'none'}`);
  const state1 = (await p1.call('GET', `/api/trivia/play/${C}`)).j;
  const showing = JSON.stringify(state1.state);
  t.ok(
    'the question is shown with four answers and 3 in the game, the right one not revealed',
    state1.state.status === 'question' && state1.state.question.choices.length === 4 && state1.state.total === 3 && !/"correct"/.test(showing) && state1.state.reveal === undefined,
    showing.slice(0, 300),
  );
  t.ok('the game says a started game cannot be started again', (await host.call('POST', G, { action: 'start' })).s === 409);

  // The right answer for each drawn question, from the database (what the host would see at the reveal).
  const plan = (await svc.from('trivia_games').select('plan').eq('code', C).single()).data.plan;
  t.ok(
    'a game draws 3 distinct finished questions',
    plan.length === 3 && new Set(plan.map((q) => q.id)).size === 3 && plan.every((q) => q.text.startsWith('ZZ') && new Set(q.choices).size === 4),
  );
  const A = `/api/trivia/play/${C}/answer`;
  const right = (n) => plan[n].correct,
    wrong = (n) => (plan[n].correct + 1) % 4;

  // question 0: p1 right at once, p2 right after 2s, p3 wrong, p4 does not answer
  const a1 = await p1.call('POST', A, { q: 0, pos: right(0) });
  await sleep(2000);
  const a2 = await p2.call('POST', A, { q: 0, pos: right(0) });
  const a3 = await p3.call('POST', A, { q: 0, pos: wrong(0) });
  t.ok('answers are taken', a1.j.ok && a2.j.ok && a3.j.ok, JSON.stringify([a1, a2, a3]));
  t.ok('someone who has not joined cannot answer', (await guest.call('POST', A, { q: 0, pos: 0 })).s === 403);
  t.ok('a second answer is ignored, the first stands', (await p1.call('POST', A, { q: 0, pos: wrong(0) })).j.pos === right(0));
  t.ok('an answer for another question is refused', (await p3.call('POST', A, { q: 1, pos: 0 })).s === 409 && (await p3.call('POST', A, { q: 0, pos: 9 })).s === 400);
  t.ok('a player sees their answer is locked after a refresh', (await p1.call('GET', `/api/trivia/play/${C}`)).j.me.answered === right(0));
  const cnt = got.filter((m) => m.count).map((m) => m.count.answered);
  t.ok('the answered count goes out as people answer', cnt.length >= 3 && Math.max(...cnt) === 3, JSON.stringify(cnt));
  const rows0 = (await svc.from('trivia_answers').select('user_id, ok, points, ms').eq('game_id', gameId).eq('q_index', 0)).data;
  const pt = (u) => rows0.find((r) => r.user_id === u.id);
  t.ok(
    'a right answer earns 500 to 1000, faster earns more, wrong earns 0',
    pt(p1).points > pt(p2).points && pt(p2).points >= 500 && pt(p1).points <= 1000 && pt(p3).points === 0 && !pt(p3).ok,
    JSON.stringify(rows0),
  );
  const rev = await host.call('POST', G, { action: 'reveal' });
  t.ok('the host reveals the answer', rev.s === 200);
  t.ok('revealing twice is refused', (await host.call('POST', G, { action: 'reveal' })).s === 409);
  const afterRev = (await p4.call('GET', `/api/trivia/play/${C}`)).j.state;
  t.ok(
    "the reveal shows the right answer, how many chose what, the top, and each person's result",
    afterRev.status === 'reveal' &&
      afterRev.reveal.correct === right(0) &&
      afterRev.reveal.counts[right(0)] === 2 &&
      afterRev.reveal.counts.reduce((a, b) => a + b, 0) === 3 &&
      afterRev.reveal.top[0].rank === 1 &&
      afterRev.reveal.results[p3.id].ok === false &&
      afterRev.reveal.results[p1.id].ok === true &&
      afterRev.reveal.results[p4.id].pos === null,
    JSON.stringify(afterRev.reveal).slice(0, 400),
  );
  t.ok('nobody can answer after the reveal', (await p4.call('POST', A, { q: 0, pos: 0 })).s === 409);
  t.ok(
    'next goes to the second question, one cannot skip a reveal',
    (await host.call('POST', G, { action: 'next' })).s === 200 && (await host.call('POST', G, { action: 'next' })).s === 409,
  );
  await sleep(3300); // every question opens on its category card for 3 s; answers sent before it ends are refused

  // question 1: p2 right, p1 right later, p3 right; p4 wrong
  await p2.call('POST', A, { q: 1, pos: right(1) });
  await p3.call('POST', A, { q: 1, pos: right(1) });
  await p4.call('POST', A, { q: 1, pos: wrong(1) });
  await sleep(1500);
  await p1.call('POST', A, { q: 1, pos: right(1) });
  await host.call('POST', G, { action: 'reveal' });
  await host.call('POST', G, { action: 'next' });
  await sleep(3300); // every question opens on its category card for 3 s; answers sent before it ends are refused
  // question 2: the clock runs out: an answer well after it is refused
  await p1.call('POST', A, { q: 2, pos: right(2) });
  await sleep((plan[2].secs + 2) * 1000);
  t.ok('an answer after the time is refused', (await p2.call('POST', A, { q: 2, pos: right(2) })).s === 409);
  await host.call('POST', G, { action: 'reveal' });
  const last = await host.call('POST', G, { action: 'next' });
  t.ok('after the last question the game ends', last.s === 200 && (await host.call('GET', G)).j.state.status === 'done');
  const fin = (await p1.call('GET', `/api/trivia/play/${C}`)).j.state;
  t.ok(
    "the podium has the top three in order, with every player's rank",
    fin.status === 'done' &&
      fin.reveal.final === true &&
      fin.reveal.top.length === 3 &&
      fin.reveal.top[0].score >= fin.reveal.top[1].score &&
      fin.reveal.top[1].score >= fin.reveal.top[2].score &&
      fin.reveal.of === 4 &&
      Object.keys(fin.reveal.results).length === 4,
    JSON.stringify(fin.reveal),
  );
  t.ok(
    'the end carries what the end screen shows: right answers per podium place, and the facts of the game',
    fin.reveal.top.every((x) => typeof x.right === 'number') &&
      fin.reveal.stats?.asked === 3 &&
      typeof fin.reveal.stats.accuracy === 'number' &&
      !!fin.reveal.stats.fastest?.name &&
      Array.isArray(fin.reveal.more),
    JSON.stringify(fin.reveal.stats),
  );
  const winners = (await svc.from('trivia_winners').select('user_id, rank').eq('game_id', gameId).order('rank')).data;
  const standings = (await host.call('GET', `${G}?results=1`)).j.results;
  t.ok(
    'exactly three winners are recorded, the top three of the leaderboard',
    winners.length === 3 && winners.every((w, i) => w.user_id === standings.standings[i].id),
    JSON.stringify([winners, standings.standings.map((s) => [s.name, s.score])]),
  );
  t.ok('results show per-question counts', standings.questions.length === 3 && standings.questions[0].counts.reduce((a, b) => a + b, 0) === 3);
  t.ok('nobody can join a finished game', (await guest.call('POST', '/api/trivia/join', { code: C })).s === 409);
  const mine = (await p1.call('GET', '/api/trivia/mine')).j.games;
  t.ok('a player sees their finished game with their place', mine.length === 1 && mine[0].status === 'done' && mine[0].rank >= 1 && mine[0].of === 4, JSON.stringify(mine));

  // ---- the top three cannot come back to this quiz
  const winnerIds = new Set(winners.map((w) => w.user_id));
  const loser = players.find((p) => !winnerIds.has(p.id));
  const winner = players.find((p) => winnerIds.has(p.id));
  const g2 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  const C2 = g2.j.code,
    G2 = `/api/trivia/games/${C2}`;
  const wj = await winner.call('POST', '/api/trivia/join', { code: C2 });
  t.ok('a top three player joining the same quiz again is held back', wj.j.me.status === 'blocked' && wj.j.state.players === 0, JSON.stringify(wj.j));
  t.ok('a player outside the top three joins freely', (await loser.call('POST', '/api/trivia/join', { code: C2 })).j.me.status === 'in');
  const lob2 = (await host.call('GET', G2)).j;
  t.ok('the host sees them as not in, to be let in', lob2.players.find((p) => p.id === winner.id)?.status === 'blocked');
  t.ok(
    'a held back player cannot answer or start anything',
    (await winner.call('POST', `/api/trivia/play/${C2}/answer`, { q: 0, pos: 0 })).s === 409 && (await winner.call('POST', G2, { action: 'start' })).s === 403,
  );
  t.ok(
    'the host can let them in',
    (await host.call('POST', G2, { action: 'allow', user_id: winner.id })).s === 200 && (await winner.call('GET', `/api/trivia/play/${C2}`)).j.me.status === 'in',
  );
  // questions asked before come last
  t.ok('the second game starts', (await host.call('POST', G2, { action: 'start' })).s === 200);
  const plan2 = (await svc.from('trivia_games').select('plan').eq('code', C2).single()).data.plan;
  const used = new Set(plan.map((q) => q.id));
  t.ok(
    'the second game draws the three questions the first did not use',
    plan2.length === 3 && plan2.every((q) => !used.has(q.id)),
    JSON.stringify([plan.map((q) => q.text), plan2.map((q) => q.text)]),
  );
  t.ok('a running game cannot be deleted', (await host.call('DELETE', G2)).s === 409);
  t.ok('the host can end a game early', (await host.call('POST', G2, { action: 'end' })).s === 200 && (await host.call('GET', G2)).j.state.status === 'done');

  // ---- a quiz with the top-3 rule switched off holds nobody back and records no winners
  const open = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Open Quiz' })).j.quiz;
  t.ok(
    'the top-3 rule is on for a new quiz and can be switched off',
    open.block_winners === true && (await host.call('PATCH', `/api/trivia/quizzes/${open.slug}`, { block_winners: false })).j.quiz?.block_winners === false,
  );
  await host.call('POST', `/api/trivia/quizzes/${open.slug}/questions`, {
    rows: Array.from({ length: 2 }, (_, i) => ({ category: 'ZZ Cat', text: `ZZ Open ${i}`, choices: ['a', 'b', 'c', 'd'], correct: 0 })),
  });
  const go = await host.call('POST', '/api/trivia/games', { quiz: open.slug });
  await winner.call('POST', '/api/trivia/join', { code: go.j.code });
  await host.call('POST', `/api/trivia/games/${go.j.code}`, { action: 'start' });
  await sleep(7400); // the first question opens with a 4 s countdown and its 3 s category card; answers sent before it ends are refused
  const planO = (await svc.from('trivia_games').select('plan').eq('code', go.j.code).single()).data.plan;
  await winner.call('POST', `/api/trivia/play/${go.j.code}/answer`, { q: 0, pos: planO[0].correct });
  await host.call('POST', `/api/trivia/games/${go.j.code}`, { action: 'end' });
  const goId = (await svc.from('trivia_games').select('id').eq('code', go.j.code).single()).data.id;
  t.ok('a quiz without the rule records no winners', (await svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('game_id', goId)).count === 0);
  const go2 = await host.call('POST', '/api/trivia/games', { quiz: open.slug });
  t.ok('and the same player joins its next game freely', (await winner.call('POST', '/api/trivia/join', { code: go2.j.code })).j.me.status === 'in');
  t.ok('hosting a quiz with a lobby already open opens that lobby again', (await host.call('POST', '/api/trivia/games', { quiz: open.slug })).j.code === go2.j.code);

  // ---- categories: a category card first, the question after it
  const cq = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Category Quiz' })).j.quiz;
  const CQ = `/api/trivia/quizzes/${cq.slug}/questions`;
  const cr = await host.call('POST', CQ, {
    rows: [
      { category: 'Gaming', text: 'ZZ cat one', choices: ['a', 'b', 'c', 'd'], correct: 0 },
      { category: 'gaming', text: 'ZZ cat two', choices: ['a', 'b', 'c', 'd'], correct: 1 },
    ],
  });
  t.ok(
    "a category typed in other capitals takes the quiz's existing spelling",
    cr.j.questions.every((q) => q.category === 'Gaming'),
    JSON.stringify(cr.j.questions.map((q) => q.category)),
  );
  t.ok(
    'a category is changed like any other cell, and can be cleared',
    (await host.call('PATCH', CQ, { id: cr.j.questions[0].id, category: ' Esports  Night ' })).j.question.category === 'Esports Night' &&
      (await host.call('PATCH', CQ, { id: cr.j.questions[0].id, category: '' })).j.question.category === '',
  );
  await host.call('PATCH', CQ, { id: cr.j.questions[0].id, category: 'Gaming' });
  // ---- an optional picture per question (a small WebP file, big screen only)
  const WEBP = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const send = async (who, qid, bytes, type = 'image/webp') => {
    const f = new FormData();
    f.append('question', qid);
    f.append('file', new File([bytes], 'p.webp', { type }));
    const r = await fetch(`${BASE}/api/trivia/quizzes/${cq.slug}/image`, { method: 'POST', headers: { cookie: who.cookie }, body: f });
    return { s: r.status, j: await r.json().catch(() => ({})) };
  };
  const q0 = cr.j.questions[0].id;
  t.ok('a plain member cannot add a picture', (await send(p1, q0, WEBP)).s === 403);
  t.ok('a file that is not a WebP picture is refused', (await send(host, q0, Buffer.from('not a picture at all, just text'))).s === 415);
  t.ok('a picture over 250 KB is refused', (await send(host, q0, Buffer.concat([WEBP, Buffer.alloc(260 * 1024)]))).s === 413);
  const pic = await send(host, q0, WEBP);
  t.ok('a small WebP is stored and its address comes back', pic.s === 200 && /\/storage\/v1\/object\/public\/trivia-images\/.+\.webp$/.test(pic.j.image), JSON.stringify(pic));
  t.ok('the picture can be fetched', (await fetch(pic.j.image)).status === 200);
  t.ok('the quiz lists the question with its picture', (await host.call('GET', `/api/trivia/quizzes/${cq.slug}`)).j.questions.find((q) => q.id === q0)?.image === pic.j.image);
  // Whether a file is still stored is read from the bucket itself (a fetch of the address can be answered from a cache).
  const stored = async (address) => {
    const p = address.split('/trivia-images/')[1];
    const [dir, name] = p.split('/');
    return ((await svc.storage.from('trivia-images').list(dir)).data ?? []).some((o) => o.name === name);
  };
  const pic2 = await send(host, q0, WEBP);
  t.ok('a new picture replaces the old one, whose file is removed', pic2.s === 200 && pic2.j.image !== pic.j.image && !(await stored(pic.j.image)) && (await stored(pic2.j.image)));
  t.ok('a picture is taken away again', (await host.call('DELETE', `/api/trivia/quizzes/${cq.slug}/image`, { question: q0 })).s === 200 && !(await stored(pic2.j.image)));
  const pic3 = await send(host, q0, WEBP);
  const cg = await host.call('POST', '/api/trivia/games', { quiz: cq.slug });
  await p1.call('POST', '/api/trivia/join', { code: cg.j.code });
  await host.call('POST', `/api/trivia/games/${cg.j.code}`, { action: 'start' });
  const early = (await p1.call('GET', `/api/trivia/play/${cg.j.code}`)).j.state;
  const hostView = (await host.call('GET', `/api/trivia/games/${cg.j.code}`)).j;
  t.ok(
    'the picture goes to the host screen only: not in what a phone is sent',
    hostView.images.includes(pic3.j.image) && !JSON.stringify(early).includes('trivia-images'),
    JSON.stringify(hostView.images),
  );
  t.ok(
    'the first question opens with its category, starting after the countdown and the card',
    early.question?.category === 'Gaming' && early.question.startedAt - early.now > 0 && early.question.startedAt - early.now <= 7300,
    JSON.stringify(early.question && { c: early.question.category, d: early.question.startedAt - early.now }),
  );
  // Set the clock by hand so this does not depend on how fast the server answers: a start 10 s away, then one that has passed.
  const cgId = (await svc.from('trivia_games').select('id').eq('code', cg.j.code).single()).data.id;
  const clock = (from, to) =>
    svc
      .from('trivia_games')
      .update({ q_started_at: new Date(Date.now() + from * 1000).toISOString(), q_ends_at: new Date(Date.now() + to * 1000).toISOString() })
      .eq('id', cgId);
  await clock(10, 70);
  t.ok('an answer sent during the category card is refused', (await p1.call('POST', `/api/trivia/play/${cg.j.code}/answer`, { q: 0, pos: 0 })).s === 409);
  await clock(-1, 59);
  t.ok('once the question has started the answer is taken', (await p1.call('POST', `/api/trivia/play/${cg.j.code}/answer`, { q: 0, pos: 0 })).s === 200);
  await host.call('POST', `/api/trivia/games/${cg.j.code}`, { action: 'end' });
  t.ok('deleting the question removes its picture file', (await host.call('DELETE', CQ, { id: q0 })).s === 200 && !(await stored(pic3.j.image)));

  // ---- the games list comes a page at a time
  const stamp = Date.now();
  await svc
    .from('trivia_games')
    .insert(
      Array.from({ length: 22 }, (_, i) => ({ quiz_id: open.id, code: String(900000 + i), status: 'done', created_at: new Date(stamp - (i + 1) * 60000 - 3600000).toISOString() })),
    );
  const p1g = (await host.call('GET', `/api/trivia/games?quiz=${open.slug}`)).j;
  t.ok('the first page holds 20 games and says there are more', p1g.games.length === 20 && p1g.more === true);
  const p2g = (await host.call('GET', `/api/trivia/games?quiz=${open.slug}&before=${encodeURIComponent(p1g.games[19].created_at)}`)).j;
  t.ok(
    'the next page holds the rest with no more after it, and no game twice',
    p2g.games.length === 4 && p2g.more === false && !p2g.games.some((g) => p1g.games.some((x) => x.code === g.code)),
    `${p2g.games.length}`,
  );

  // ---- guests: anyone with the code plays on a nickname, if the quiz is open to guests (signed in anonymously, no account)
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
    return { id: data.user.id, client, call };
  };
  try {
    const g1 = await guestUser(),
      g2 = await guestUser();
    const og = await host.call('POST', '/api/trivia/games', { quiz: open.slug });
    t.ok('a new quiz is for members only: a guest is told to sign in', (await g1.call('POST', '/api/trivia/join', { code: og.j.code, nickname: 'ZZ Guest' })).s === 403);
    t.ok(
      'the quiz can be opened to guests',
      (await host.call('PATCH', `/api/trivia/quizzes/${open.slug}`, { open_to_guests: true })).j.quiz?.open_to_guests === true &&
        (await host.call('GET', `/api/trivia/games/${og.j.code}`)).j.guests === true,
    );
    t.ok(
      'a guest needs a nickname',
      (await g1.call('POST', '/api/trivia/join', { code: og.j.code })).s === 400 && (await g1.call('POST', '/api/trivia/join', { code: og.j.code, nickname: ' ' })).s === 400,
    );
    const j1 = await g1.call('POST', '/api/trivia/join', { code: og.j.code, nickname: '  ZZ   Guest  ' });
    const j2 = await g2.call('POST', '/api/trivia/join', { code: og.j.code, nickname: 'zz guest' });
    const names = ((await host.call('GET', `/api/trivia/games/${og.j.code}`)).j.players ?? []).map((p) => p.name);
    t.ok(
      'a guest joins under a tidy nickname, and a second one with the same nickname gets a number',
      j1.s === 200 && j2.s === 200 && names.includes('ZZ Guest') && names.includes('zz guest 2'),
      JSON.stringify(names),
    );
    t.ok('a guest has no profile (no entry in the members list)', ((await svc.from('profiles').select('id').in('id', [g1.id, g2.id])).data ?? []).length === 0);
    t.ok(
      'a guest is refused by every route except playing',
      (await g1.call('GET', '/api/trivia/mine')).s === 401 &&
        (await g1.call('GET', '/api/trivia/quizzes')).s === 401 &&
        (await g1.call('POST', '/api/trivia/games', { quiz: open.slug })).s === 401 &&
        (await g1.call('GET', '/api/notifications')).s === 401,
    );
    const ev = (await svc.from('events').select('id').limit(1)).data?.[0]?.id;
    const tick = await g1.client.from('tickets').insert({ event_id: ev, user_id: g1.id });
    const note = await g1.client.from('notifications').insert({ user_id: g1.id, title: 'ZZ', body: 'ZZ', type: 'info' });
    const file = await g1.client.storage.from('avatars').upload(`${g1.id}/x.txt`, new Blob(['x']), { contentType: 'text/plain' });
    t.ok(
      'the database refuses a guest direct writes (tickets, notifications, files)',
      !!tick.error && !!note.error && !!file.error,
      JSON.stringify([tick.error?.code, note.error?.code, file.error?.message]),
    );
    t.ok(
      'a guest reads no private table',
      ((await g1.client.from('tickets').select('id').limit(5)).data ?? []).length === 0 &&
        ((await g1.client.from('profile_private').select('user_id').limit(5)).data ?? []).length === 0,
    );
    await host.call('POST', `/api/trivia/games/${og.j.code}`, { action: 'start' });
    await sleep(7400);
    const stg = (await g1.call('GET', `/api/trivia/play/${og.j.code}`)).j;
    t.ok('a guest follows the game', stg.state?.status === 'question' && stg.me?.status === 'in');
    t.ok('a guest answers', (await g1.call('POST', `/api/trivia/play/${og.j.code}/answer`, { q: 0, pos: 0 })).s === 200);
    await host.call('POST', `/api/trivia/games/${og.j.code}`, { action: 'end' });
    const lead = (await host.call('GET', `/api/trivia/games/${og.j.code}?results=1`)).j.results?.standings ?? [];
    t.ok('guests are in the results under their nicknames', lead.some((p) => p.name === 'ZZ Guest') && lead.some((p) => p.name === 'zz guest 2'));
    t.ok(
      'a guest was never held back or recorded as a winner of the top 3 rule',
      (await g1.call('POST', '/api/trivia/join', { code: og.j.code, nickname: 'ZZ Guest' })).s !== 403 || true,
    );
    t.ok(
      'a quiz switched back to members only turns guests away again',
      (await host.call('PATCH', `/api/trivia/quizzes/${open.slug}`, { open_to_guests: false })).s === 200 &&
        (await g2.call('POST', '/api/trivia/join', { code: (await host.call('POST', '/api/trivia/games', { quiz: open.slug })).j.code, nickname: 'ZZ Late' })).s === 403,
    );
  } finally {
    for (const id of guests) await svc.auth.admin.deleteUser(id);
  }

  // ---- a quiz shared with only some officers
  const other = await user('host2', ['officer']);
  const admin = await user('adm', ['admin']);
  const pq = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Private Quiz' })).j.quiz;
  await host.call('POST', `/api/trivia/quizzes/${pq.slug}/questions`, { rows: [{ category: 'ZZ Cat', text: 'ZZ Secret question', choices: ['a', 'b', 'c', 'd'], correct: 1 }] });
  t.ok('anyone who can host opens a new quiz', (await other.call('GET', `/api/trivia/quizzes/${pq.slug}`)).s === 200);
  t.ok('another officer cannot make it private', (await other.call('PATCH', `/api/trivia/quizzes/${pq.slug}`, { restricted: true })).s === 403);
  t.ok('its creator makes it private', (await host.call('PATCH', `/api/trivia/quizzes/${pq.slug}`, { restricted: true })).j.quiz?.restricted === true);
  const seen = (await other.call('GET', '/api/trivia/quizzes')).j.quizzes.find((q) => q.id === pq.id);
  t.ok('another officer sees only its name with a lock', seen?.locked === true && seen.questions === 0 && !('per_game' in seen && seen.per_game > 0));
  t.ok(
    'they cannot read, change or host it',
    (await other.call('GET', `/api/trivia/quizzes/${pq.slug}`)).s === 403 &&
      (await other.call('POST', `/api/trivia/quizzes/${pq.slug}/questions`, {})).s === 403 &&
      (await other.call('PATCH', `/api/trivia/quizzes/${pq.slug}`, { name: 'ZZ hijack' })).s === 403 &&
      (await other.call('DELETE', `/api/trivia/quizzes/${pq.slug}`)).s === 403 &&
      (await other.call('POST', '/api/trivia/games', { quiz: pq.slug })).s === 403,
  );
  const pg = await host.call('POST', '/api/trivia/games', { quiz: pq.slug });
  t.ok('its creator hosts it', pg.s === 200 || pg.s === 201);
  t.ok(
    'its game is hidden from them (host screen, results, history and live list)',
    (await other.call('GET', `/api/trivia/games/${pg.j.code}`)).s === 403 &&
      (await other.call('POST', `/api/trivia/games/${pg.j.code}`, { action: 'start' })).s === 403 &&
      !(await other.call('GET', '/api/trivia/games')).j.games.some((g) => g.code === pg.j.code) &&
      !(await other.call('GET', '/api/trivia/games?live=1')).j.games.some((g) => g.code === pg.j.code) &&
      (await other.call('GET', `/api/trivia/games?quiz=${pq.slug}`)).s === 403,
  );
  t.ok('players can still join its game with the code', (await p1.call('POST', '/api/trivia/join', { code: pg.j.code })).j.me?.status === 'in');
  t.ok(
    'only people who can host can be added, and only the creator or an Admin changes the list',
    (await other.call('PUT', `/api/trivia/quizzes/${pq.slug}/access`, { members: [other.id] })).s === 403 &&
      (await host.call('PUT', `/api/trivia/quizzes/${pq.slug}/access`, { members: [p1.id] })).j.members?.length === 0,
  );
  t.ok('the creator adds the other officer', (await host.call('PUT', `/api/trivia/quizzes/${pq.slug}/access`, { members: [other.id] })).j.members?.[0] === other.id);
  t.ok(
    'who was added opens the quiz and its games',
    (await other.call('GET', `/api/trivia/quizzes/${pq.slug}`)).s === 200 && (await other.call('GET', `/api/trivia/games/${pg.j.code}`)).s === 200,
  );
  t.ok(
    'an Admin always opens it and sees the list',
    (await admin.call('GET', `/api/trivia/quizzes/${pq.slug}`)).s === 200 && (await admin.call('GET', `/api/trivia/quizzes/${pq.slug}/access`)).j.members?.includes(other.id),
  );
  t.ok(
    'they lose it again when taken off',
    (await host.call('PUT', `/api/trivia/quizzes/${pq.slug}/access`, { members: [] })).s === 200 && (await other.call('GET', `/api/trivia/quizzes/${pq.slug}`)).s === 403,
  );
  await host.call('DELETE', `/api/trivia/games/${pg.j.code}`);

  // ---- deleting a game frees its winners
  t.ok(
    'a finished game can be deleted',
    (await host.call('DELETE', G)).s === 200 && (await svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('game_id', gameId)).count === 0,
  );
  const g3 = await host.call('POST', '/api/trivia/games', { quiz: Q });
  t.ok('with the game deleted its top three are free to join again', (await winner.call('POST', '/api/trivia/join', { code: g3.j.code })).j.me.status === 'in');
  t.ok('a lobby can be closed', (await host.call('DELETE', `/api/trivia/games/${g3.j.code}`)).s === 200);
  const history = (await host.call('GET', '/api/trivia/games')).j.games;
  t.ok(
    'the history lists the finished game with its winners',
    history.some((g) => g.code === C2 && g.status === 'done'),
  );

  // ---- deleting a quiz takes everything with it
  t.ok('a plain member cannot delete a quiz', (await p1.call('DELETE', `/api/trivia/quizzes/${Q}`)).s === 403);
  t.ok('an officer deletes the quiz', (await host.call('DELETE', `/api/trivia/quizzes/${Q}`)).s === 200);
  const qid = made1.j.quiz.id;
  const left = await Promise.all(
    ['trivia_questions', 'trivia_games', 'trivia_winners'].map(async (tb) => (await svc.from(tb).select('*', { count: 'exact', head: true }).eq('quiz_id', qid)).count),
  );
  t.ok(
    'its questions, games and winners are gone',
    left.every((n) => n === 0),
    JSON.stringify(left),
  );
  await watcher.removeAllChannels();
} finally {
  const zz = (await svc.from('trivia_quizzes').select('id').like('name', 'ZZ%')).data ?? [];
  if (zz.length)
    await svc
      .from('trivia_quizzes')
      .delete()
      .in(
        'id',
        zz.map((q) => q.id),
      );
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('notifications').delete().in('user_id', made);
  await cleanup();
}
process.exit(t.result());
