// Trivia the way an event goes: a host, a crowd of members and guests playing at once, with the things that really happen: people joining at the wrong time, answering twice, too early, too late or on the very tick the
// host closes the question, a removed player, the host pausing, adding time and skipping, a question nobody answers, the host pressing buttons out of order, strangers poking the host's routes, and the winners rule on a second game.
// Guests are made as real accounts flagged anonymous in the database (the real "anonymous sign-in" is limited to 30 an hour per network address, which a test must not use up). Everything is deleted at the end.
// Run: BASE_URL=http://localhost:3000 node scripts/checks/trivia-live.mjs
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { svc, tracker, accounts, BASE, env, url } from './lib.mjs';

const t = tracker();
const { user, cleanup, made } = accounts('live');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ref = new URL(url).hostname.split('.')[0];
const guestIds = [];
const lat = { join: [], answer: [] };
const timed = async (kind, fn) => {
  const t0 = Date.now();
  const r = await fn();
  lat[kind].push(Date.now() - t0);
  return r;
};
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((a.length * p) / 100))] ?? 0;

async function makeGuests(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const email = `mtg-live-guest${i}-${Date.now()}@example.test`;
    const { data } = await svc.auth.admin.createUser({ email, email_confirm: true });
    guestIds.push(data.user.id);
    out.push({ id: data.user.id, email });
  }
  // flag them anonymous in one go: to the server they are then exactly what a /play guest is
  execSync(`npx supabase db query --linked --yes "update auth.users set is_anonymous = true where id in (${out.map((g) => `'${g.id}'`).join(',')})"`, {
    cwd: new URL('../../', import.meta.url).pathname,
    stdio: 'ignore',
  });
  const client = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const people = [];
  for (const g of out) {
    let s = null;
    for (let attempt = 0; attempt < 40 && !s?.session; attempt++) {
      if (attempt) await sleep(8000 + Math.random() * 4000);
      const { data: lk } = await svc.auth.admin.generateLink({ type: 'magiclink', email: g.email });
      if (!lk?.properties) continue;
      ({ data: s } = await client.auth.verifyOtp({ token_hash: lk.properties.hashed_token, type: 'magiclink' }));
    }
    if (!s?.session) throw new Error('could not sign in a guest');
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString('base64url')}`;
    const call = async (method, path, body) => {
      const r = await fetch(BASE + path, { method, headers: { cookie, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      let j = {};
      try {
        j = await r.json();
      } catch {
        /* not JSON */
      }
      return { s: r.status, j };
    };
    people.push({ id: g.id, call, guest: true });
  }
  return people;
}

let quizSlug, quiz2Slug;
try {
  const host = await user('host', ['ucsd', 'officer']);
  const members = [];
  for (let i = 0; i < 21; i++) members.push({ ...(await user(`m${i}`, ['ucsd'])), guest: false });
  const guests = await makeGuests(6);
  const late = members.pop(); // joins after the game has started
  const removed = members[19];
  const everyone = [...members, ...guests];

  // ---- the quiz: written order, 10 seconds a question, guests welcome, the top three may not replay
  quizSlug = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Live Quiz' })).j.quiz.slug;
  await host.call('PATCH', `/api/trivia/quizzes/${quizSlug}`, { shuffle_questions: false, secs_per_question: 10, open_to_guests: true, block_winners: true, phone_text: true });
  const rows = [
    { category: 'ZZ One', text: 'ZZ live 1 normal', choices: ['a', 'b', 'c', 'd'], correct: 0 },
    { category: 'ZZ One', text: 'ZZ live 2 two right answers', choices: ['a', 'b', 'c', 'd'], correct: 0, also: [2] },
    { category: 'ZZ Two', text: 'ZZ live 3 race', choices: ['a', 'b', 'c', 'd'], correct: 1 },
    { category: 'ZZ Two', text: 'ZZ live 4 nobody answers', choices: ['a', 'b', 'c', 'd'], correct: 2 },
    { category: 'ZZ Three', text: 'ZZ live 5 host controls', choices: ['a', 'b', 'c', 'd'], correct: 3 },
    { category: 'ZZ Three', text: 'ZZ live 6 last', choices: ['a', 'b', 'c', 'd'], correct: 0 },
  ];
  const made1 = await host.call('POST', `/api/trivia/quizzes/${quizSlug}/questions`, { rows });
  t.ok('the quiz is made', made1.s < 300, JSON.stringify(made1));

  // ---- the lobby: everyone joins at once
  const gm = await host.call('POST', '/api/trivia/games', { quiz: quizSlug });
  const code = gm.j.code;
  const G = `/api/trivia/games/${code}`;
  t.ok('a lobby opens', gm.s === 201 && /^\d{6}$/.test(code));
  t.ok('a short nickname is refused for a guest', (await guests[0].call('POST', '/api/trivia/join', { code, nickname: 'x' })).s === 400);
  t.ok('a guest without a nickname is refused', (await guests[0].call('POST', '/api/trivia/join', { code })).s === 400);
  const joins = await Promise.all(
    everyone.map((p, i) =>
      timed('join', () =>
        p.call('POST', '/api/trivia/join', {
          code: i % 2 ? code : `${code.slice(0, 3)}-${code.slice(3)}`,
          ...(p.guest ? { nickname: i === 24 || i === 25 ? 'ZZ Dup' : `ZZ Guest ${i}` } : {}),
        }),
      ),
    ),
  );
  t.ok(
    `all ${everyone.length} join at once (codes typed with a dash or plain)`,
    joins.every((r) => r.s === 200 && r.j.me.status === 'in'),
    JSON.stringify(joins.filter((r) => r.s !== 200).slice(0, 2)),
  );
  t.ok('joining again is harmless', (await members[0].call('POST', '/api/trivia/join', { code })).s === 200);
  let lobby = (await host.call('GET', G)).j;
  t.ok(
    'the host sees everyone, once each',
    lobby.players.length === everyone.length && new Set(lobby.players.map((p) => p.id)).size === everyone.length,
    `${lobby.players.length}`,
  );
  const dups = lobby.players
    .filter((p) => p.name.startsWith('ZZ Dup'))
    .map((p) => p.name)
    .sort();
  t.ok('two guests with the same nickname are told apart', dups.length === 2 && dups[0] !== dups[1], JSON.stringify(dups));
  t.ok('a wrong code is not a game', (await members[0].call('POST', '/api/trivia/join', { code: '000000' })).s === 404);
  t.ok(
    'a signed-out visitor cannot join',
    (await fetch(`${BASE}/api/trivia/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).status === 401,
  );
  t.ok('the host sends someone out', (await host.call('POST', G, { action: 'remove', user_id: removed.id })).s === 200);
  t.ok('a removed player coming back is still out', (await removed.call('POST', '/api/trivia/join', { code })).j.me.status === 'removed');
  t.ok('a member cannot use the host screen or its buttons', (await members[1].call('GET', G)).s === 403 && (await members[1].call('POST', G, { action: 'start' })).s === 403);
  const gEnd = await guests[0].call('POST', G, { action: 'end' });
  const gList = await guests[0].call('GET', '/api/trivia/quizzes');
  t.ok(
    'a guest cannot use the host buttons, nor list quizzes',
    [401, 403].includes(gEnd.s) && [401, 403].includes(gList.s),
    `${gEnd.s} ${gList.s} ${JSON.stringify(gList.j).slice(0, 100)}`,
  );

  // ---- start, and a late joiner
  t.ok('the game starts', (await host.call('POST', G, { action: 'start' })).s === 200);
  t.ok('starting twice is refused', (await host.call('POST', G, { action: 'start' })).s === 409);
  const lj = await late.call('POST', '/api/trivia/join', { code });
  t.ok('someone can still join after the start', lj.s === 200 && lj.j.me.status === 'in');
  const q = async () => (await host.call('GET', G)).j.state.question;
  let qs = await q();
  t.ok('the first question comes with a countdown and its category card', qs.startedAt - Date.now() > 3000, `${qs.startedAt - Date.now()}`);
  const ans = (p, qi, body) => timed('answer', () => p.call('POST', `/api/trivia/play/${code}/answer`, { q: qi, ...body }));
  t.ok('an answer before the clock starts is refused', (await ans(members[0], 0, { pos: 0 })).s === 409);
  await sleep(Math.max(0, qs.startedAt - Date.now()) + 400);

  // ---- question 1: a crowd answers at once, with the mistakes people make
  const plan = (await svc.from('trivia_games').select('plan').eq('code', code).single()).data.plan;
  const right1 = plan[0].correct;
  const wrong1 = (right1 + 1) % 4;
  const expect = new Map(); // player id -> [pos, ok]
  const r1 = await Promise.all(
    everyone.map(async (p, i) => {
      if (p === removed || i === 18 || i === 25) return null; // one removed, two never answer
      const pos = i % 3 === 0 ? wrong1 : right1;
      await sleep(i * 70);
      const r = await ans(p, 0, { pos });
      if (r.s === 200) expect.set(p.id, [pos, pos === right1]);
      return r;
    }),
  );
  t.ok(
    'everyone who answered got in',
    r1.filter(Boolean).every((r) => r.s === 200),
    JSON.stringify(r1.filter((r) => r && r.s !== 200).slice(0, 2)),
  );
  const again = await ans(members[1], 0, { pos: (expect.get(members[1].id)[0] + 1) % 4 });
  t.ok(
    'a second answer from the same person is ignored, the first stays',
    again.s === 200 && again.j.again === true && again.j.pos === expect.get(members[1].id)[0],
    JSON.stringify(again.j),
  );
  t.ok('an answer outside the four is refused', (await ans(members[2], 0, { pos: 4 })).s === 400 && (await ans(members[2], 0, { pos: -1 })).s === 400);
  t.ok('an answer for another question is refused', (await ans(members[2], 5, { pos: 0 })).s === 409);
  t.ok('a removed player cannot answer', (await ans(removed, 0, { pos: 0 })).s === 403);
  t.ok(
    'a signed-out visitor cannot answer',
    (await fetch(`${BASE}/api/trivia/play/${code}/answer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: 0, pos: 0 }) })).status ===
      401,
  );
  const lateAns = await ans(late, 0, { pos: right1 });
  if (lateAns.s === 200) expect.set(late.id, [right1, true]);
  t.ok('the late joiner can answer too', lateAns.s === 200);
  const st1 = (await host.call('GET', G)).j.state;
  t.ok('the host sees how many have answered', st1.answered === expect.size, `${st1.answered} vs ${expect.size}`);
  t.ok(
    'the phones are not told which answer is right while it is open',
    JSON.stringify((await members[3].call('GET', `/api/trivia/play/${code}`)).j.state).includes('correct') === false,
  );
  t.ok('the host closes it', (await host.call('POST', G, { action: 'reveal' })).s === 200);
  t.ok('closing twice is refused', (await host.call('POST', G, { action: 'reveal' })).s === 409);
  const rv1 = (await host.call('GET', G)).j.state.reveal;
  const dbAns1 = (
    await svc
      .from('trivia_answers')
      .select('user_id, pos, ok, points, ms')
      .eq('game_id', (await svc.from('trivia_games').select('id').eq('code', code).single()).data.id)
      .eq('q_index', 0)
  ).data;
  t.ok('every accepted answer is in the results, and nothing else', dbAns1.length === expect.size, `${dbAns1.length} vs ${expect.size}`);
  t.ok(
    'the counts per answer add up to the people who answered',
    rv1.counts.reduce((a, b) => a + b, 0) === expect.size && rv1.counts[right1] === [...expect.values()].filter((e) => e[1]).length,
  );
  t.ok(
    'right answers score 500 to 1000, wrong ones 0, and a quicker one never scores less',
    (() => {
      const right = dbAns1.filter((a) => a.ok).sort((a, b) => a.ms - b.ms);
      return (
        right.every((a) => a.points >= 500 && a.points <= 1000) &&
        right.every((a, i) => i === 0 || right[i - 1].points >= a.points) &&
        dbAns1.filter((a) => !a.ok).every((a) => a.points === 0)
      );
    })(),
  );
  t.ok(
    'everyone is marked right or wrong as they should be',
    dbAns1.every((a) => a.ok === expect.get(a.user_id)[1]),
  );
  t.ok(
    'the scoreboard is in order',
    rv1.top.every((r, i) => i === 0 || rv1.top[i - 1].score >= r.score),
  );
  t.ok('the reveal counts the players still in (the removed one is not)', rv1.of === everyone.length - 1 + 1, `${rv1.of}`);

  const nextQ = async () => {
    const r = await host.call('POST', G, { action: 'next' });
    const s = await q();
    await sleep(Math.max(0, s.startedAt - Date.now()) + 300);
    return { r, s };
  };

  // ---- question 2: two right answers, either counts
  let n = await nextQ();
  t.ok('the next question opens', n.r.s === 200);
  const plan2 = plan[1];
  const rights2 = [plan2.correct, ...(plan2.also ?? [])];
  const q2 = await Promise.all(
    members.slice(0, 8).map((p, i) => ans(p, 1, { pos: i < 4 ? rights2[i % 2] : rights2[0] + 1 === rights2[1] ? (rights2[1] + 1) % 4 : (rights2[0] + 1) % 4 })),
  );
  t.ok(
    'answers go in',
    q2.every((r) => r.s === 200),
  );
  await host.call('POST', G, { action: 'reveal' });
  const rv2 = (await host.call('GET', G)).j.state.reveal;
  t.ok(
    'either right answer is right, the others are wrong',
    members.slice(0, 4).every((p) => rv2.results[p.id].ok === true) && members.slice(4, 8).every((p) => rv2.results[p.id].ok === false),
  );

  // ---- question 3: answers arrive on the very tick the host closes the question
  n = await nextQ();
  const accepted = [];
  const closedOnes = [];
  const racers = [...members.slice(0, 12), ...guests.slice(0, 5)];
  await Promise.all([
    ...racers.map(async (p, i) => {
      await sleep(i * 6);
      const r = await ans(p, 2, { pos: 1 });
      (r.s === 200 ? accepted : closedOnes).push({ p, s: r.s });
    }),
    (async () => {
      await sleep(45);
      await host.call('POST', G, { action: 'reveal' });
    })(),
  ]);
  const gid = (await svc.from('trivia_games').select('id').eq('code', code).single()).data.id;
  const dbAns3 = (await svc.from('trivia_answers').select('user_id').eq('game_id', gid).eq('q_index', 2)).data;
  const rv3 = (await host.call('GET', G)).j.state.reveal;
  t.ok(
    `in a race (${accepted.length} in, ${closedOnes.length} too late) every accepted answer is kept and counted, every late one refused`,
    dbAns3.length === accepted.length && rv3.counts.reduce((a, b) => a + b, 0) === accepted.length && closedOnes.every((c) => c.s === 409),
    `${dbAns3.length}/${accepted.length}/${rv3.counts.reduce((a, b) => a + b, 0)}`,
  );

  // ---- question 4: nobody answers in time; grace for the slow connection, then too late
  n = await nextQ();
  qs = await q();
  await sleep(Math.max(0, qs.endsAt - Date.now()) + 300);
  const inGrace = await ans(members[3], 3, { pos: 2 });
  t.ok('an answer just after the clock (a slow phone) still counts', inGrace.s === 200, JSON.stringify(inGrace));
  await sleep(1800);
  t.ok('an answer well after the clock is refused', (await ans(members[4], 3, { pos: 2 })).s === 409);
  t.ok('the host closes a question nobody answered in time', (await host.call('POST', G, { action: 'reveal' })).s === 200);
  const rv4 = (await host.call('GET', G)).j.state.reveal;
  t.ok(
    'the slow-phone answer is right but earns the least; the others have no answer',
    rv4.results[members[3].id].ok === true && rv4.results[members[3].id].pts === 500 && rv4.results[members[5].id].pos === null && rv4.counts.reduce((a, b) => a + b, 0) === 1,
    JSON.stringify(rv4.results[members[3].id]),
  );

  // ---- question 5: the host pauses, adds time and skips
  n = await nextQ();
  t.ok('the host pauses', (await host.call('POST', G, { action: 'pause' })).s === 200);
  qs = await q();
  t.ok('a paused game does not run out on its own and takes no answers', qs.pausedAt > 0 && (await ans(members[6], 4, { pos: 3 })).s === 409);
  await sleep(1500);
  await host.call('POST', G, { action: 'resume' });
  const qr = await q();
  t.ok('resuming gives the time back', qr.endsAt - qs.endsAt >= 1400, `${qr.endsAt - qs.endsAt}`);
  t.ok('more time can be added', (await host.call('POST', G, { action: 'add-time' })).s === 200 && (await q()).endsAt - qr.endsAt === 10000);
  t.ok('answers go in again', (await ans(members[6], 4, { pos: 3 })).s === 200);
  t.ok('the host skips it', (await host.call('POST', G, { action: 'skip' })).s === 200);
  const rv5 = (await host.call('GET', G)).j.state.reveal;
  t.ok(
    'a skipped question counts for nobody',
    rv5.skipped === true &&
      Object.values(rv5.results).every((r) => r.pts === 0) &&
      (await svc.from('trivia_answers').select('user_id', { count: 'exact', head: true }).eq('game_id', gid).eq('q_index', 4)).count === 0,
  );
  t.ok('the host cannot pause when nothing is open', (await host.call('POST', G, { action: 'pause' })).s === 409);

  // ---- question 6 and the podium
  n = await nextQ();
  await Promise.all(everyone.filter((p) => p !== removed).map((p, i) => ans(p, 5, { pos: i % 4 === 0 ? 0 : 1 })));
  t.ok('the last question closes', (await host.call('POST', G, { action: 'reveal' })).s === 200);
  t.ok('the podium follows the last question', (await host.call('POST', G, { action: 'next' })).s === 200 && (await host.call('GET', G)).j.state.status === 'done');
  const final = (await host.call('GET', `${G}?results=1`)).j;
  const dbPlayers = (await svc.from('trivia_players').select('user_id, score, status').eq('game_id', gid)).data;
  const sums = new Map();
  for (const a of (await svc.from('trivia_answers').select('user_id, points').eq('game_id', gid)).data) sums.set(a.user_id, (sums.get(a.user_id) ?? 0) + a.points);
  t.ok(
    "every player's score is the sum of what they earned",
    dbPlayers.every((p) => p.score === (sums.get(p.user_id) ?? 0)),
    JSON.stringify(dbPlayers.filter((p) => p.score !== (sums.get(p.user_id) ?? 0)).slice(0, 2)),
  );
  const ranked = dbPlayers.filter((p) => p.status === 'in').sort((a, b) => b.score - a.score);
  const podium = final.state.reveal.top;
  t.ok(
    'the podium is the three highest scores',
    podium.length === 3 && podium.every((p, i) => p.score === ranked[i].score),
    JSON.stringify(podium.map((p) => p.score)) + JSON.stringify(ranked.slice(0, 3).map((p) => p.score)),
  );
  t.ok('the results screen lists everyone who played', final.results.standings.length === dbPlayers.filter((p) => p.status === 'in').length);
  t.ok('the end stats are there', final.state.reveal.stats && final.state.reveal.stats.asked >= 5);
  t.ok(
    'pressing next, end or answering after the end is refused',
    (await host.call('POST', G, { action: 'next' })).s === 409 && (await host.call('POST', G, { action: 'end' })).s === 409 && (await ans(members[0], 5, { pos: 0 })).s === 409,
  );
  t.ok('joining a finished game is refused', (await (await user('after', ['ucsd'])).call('POST', '/api/trivia/join', { code })).s === 409);
  const winners = (await svc.from('trivia_winners').select('user_id, rank').eq('game_id', gid)).data;
  t.ok('the top three are noted for the winners rule', winners.length === 3);

  // ---- a second game of the same quiz: the winners rule
  const g2 = await host.call('POST', '/api/trivia/games', { quiz: quizSlug });
  const code2 = g2.j.code;
  const G2 = `/api/trivia/games/${code2}`;
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const wmembers = winners.map((w) => byId.get(w.user_id)).filter((p) => p && !p.guest);
  const wguests = winners.map((w) => byId.get(w.user_id)).filter((p) => p && p.guest);
  const others = members.filter((p) => p !== removed && !winners.some((w) => w.user_id === p.id)).slice(0, 3);
  for (const p of others) await p.call('POST', '/api/trivia/join', { code: code2 });
  const wj = await Promise.all(wmembers.map((p) => p.call('POST', '/api/trivia/join', { code: code2 })));
  t.ok(
    'a member who won last time waits on the host list',
    wj.every((r) => r.s === 200 && r.j.me.status === 'blocked'),
    JSON.stringify(wj.map((r) => r.j.me)),
  );
  const gj = await Promise.all(wguests.map((p, i) => p.call('POST', '/api/trivia/join', { code: code2, nickname: `ZZ Win ${i}` })));
  t.ok(
    'a guest who won is never held back',
    gj.every((r) => r.s === 200 && r.j.me.status === 'in'),
  );
  if (wmembers.length)
    t.ok(
      'the host lets a winner in',
      (await host.call('POST', G2, { action: 'allow', user_id: wmembers[0].id })).s === 200 &&
        (await wmembers[0].call('POST', '/api/trivia/join', { code: code2 })).j.me.status === 'in',
    );
  await host.call('POST', G2, { action: 'start' });
  const s2 = (await host.call('GET', G2)).j.state.question;
  await sleep(Math.max(0, s2.startedAt - Date.now()) + 500);
  if (wmembers.length > 1) t.ok('a player still waiting cannot answer', (await wmembers[1].call('POST', `/api/trivia/play/${code2}/answer`, { q: 0, pos: 0 })).s === 403);
  await host.call('POST', G2, { action: 'end' });
  t.ok('the host can end a game in the middle of a question', (await host.call('GET', G2)).j.state.status === 'done');
  t.ok(
    'deleting the first game frees its winners',
    (await host.call('DELETE', G)).s === 200 && (await svc.from('trivia_winners').select('user_id', { count: 'exact', head: true }).eq('game_id', gid)).count === 0,
  );
  const g3 = await host.call('POST', '/api/trivia/games', { quiz: quizSlug });
  await others[0].call('POST', '/api/trivia/join', { code: g3.j.code });
  await host.call('POST', `/api/trivia/games/${g3.j.code}`, { action: 'start' });
  t.ok('a game that is being played cannot be deleted', (await host.call('DELETE', `/api/trivia/games/${g3.j.code}`)).s === 409);
  await host.call('POST', `/api/trivia/games/${g3.j.code}`, { action: 'end' });

  // ---- "choose all the right answers" with a crowd
  quiz2Slug = (await host.call('POST', '/api/trivia/quizzes', { name: 'ZZ Live Multi' })).j.quiz.slug;
  await host.call('PATCH', `/api/trivia/quizzes/${quiz2Slug}`, { multi_all: true, shuffle_questions: false, secs_per_question: 10, open_to_guests: true });
  await host.call('POST', `/api/trivia/quizzes/${quiz2Slug}/questions`, {
    rows: [{ category: 'ZZ M', text: 'ZZ choose all', choices: ['a', 'b', 'c', 'd'], correct: 0, also: [2, 3] }],
  });
  const g4 = await host.call('POST', '/api/trivia/games', { quiz: quiz2Slug });
  const code4 = g4.j.code;
  const six = [...members.slice(0, 4), ...guests.slice(0, 2)];
  await Promise.all(six.map((p, i) => p.call('POST', '/api/trivia/join', { code: code4, ...(p.guest ? { nickname: `ZZ Multi ${i}` } : {}) })));
  await host.call('POST', `/api/trivia/games/${code4}`, { action: 'start' });
  const s4 = (await host.call('GET', `/api/trivia/games/${code4}`)).j.state.question;
  t.ok('phones know it is a choose-all question', s4.multi === true);
  await sleep(Math.max(0, s4.startedAt - Date.now()) + 500);
  const a4 = (p, picks) => p.call('POST', `/api/trivia/play/${code4}/answer`, { q: 0, picks });
  const plan4 = (await svc.from('trivia_games').select('plan').eq('code', code4).single()).data.plan[0];
  const all3 = [plan4.correct, ...plan4.also].sort();
  const missing = [...Array(4).keys()].find((x) => !all3.includes(x));
  const results4 = await Promise.all([
    a4(six[0], all3),
    a4(six[1], all3.slice(0, 2)),
    a4(six[2], [...all3, missing]),
    a4(six[3], [...all3, ...all3]),
    a4(six[4], [...all3].reverse()),
    a4(six[5], [9]),
  ]);
  t.ok(
    'all three ticked is right (in any order, repeats ignored); some, extra or invalid is not',
    results4[0].s === 200 && results4[1].s === 200 && results4[2].s === 200 && results4[3].s === 200 && results4[4].s === 200 && results4[5].s === 400,
  );
  await host.call('POST', `/api/trivia/games/${code4}`, { action: 'reveal' });
  const rv6 = (await host.call('GET', `/api/trivia/games/${code4}`)).j.state.reveal;
  t.ok('only the exact set earns points', [0, 3, 4].every((i) => rv6.results[six[i].id].ok === true) && [1, 2].every((i) => rv6.results[six[i].id].ok === false));
  await host.call('POST', `/api/trivia/games/${code4}`, { action: 'end' });

  // ---- how fast it was with a crowd
  console.log(`INFO joins: ${lat.join.length}, p50 ${pct(lat.join, 50)} ms, p95 ${pct(lat.join, 95)} ms, max ${Math.max(...lat.join)} ms`);
  console.log(`INFO answers: ${lat.answer.length}, p50 ${pct(lat.answer, 50)} ms, p95 ${pct(lat.answer, 95)} ms, max ${Math.max(...lat.answer)} ms`);
  t.ok('answers were taken quickly under load (95 percent under 3 seconds)', pct(lat.answer, 95) < 3000, `${pct(lat.answer, 95)}`);
} catch (e) {
  console.log('ERROR', e);
  t.fail();
} finally {
  for (const s of [quizSlug, quiz2Slug]) if (s) await svc.from('trivia_quizzes').delete().eq('slug', s);
  for (const id of guestIds) await svc.auth.admin.deleteUser(id);
  if (made.length) await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ Live%');
  await cleanup();
}
process.exit(t.result());
