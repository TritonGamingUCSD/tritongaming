// Checks, over HTTP against a running dev server with throwaway ZZ accounts and a ZZ division, that Live Tools (polls, Q&A, Trivia quizzes, photo booths) belong to the club or to a division: who sees, makes and changes what. Removes everything.
// Run (after the migration 20261105240000_division_live_tools.sql is applied): node scripts/checks/division-live.mjs
import { svc, tracker, accounts } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('divlive');
let divA, divB;
const made = { polls: [], qa: [], quizzes: [], booths: [] };
const setRoles = (u, roles) => svc.rpc('admin_set_user_roles', { _user_id: u.id, _roles: roles, _granted_by: null });
try {
  divA = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divlive-a-${Date.now()}`, name: 'ZZ Divlive A' })
      .select('id')
      .single()
  ).data.id;
  divB = (
    await svc
      .from('divisions')
      .insert({ slug: `zz-divlive-b-${Date.now()}`, name: 'ZZ Divlive B' })
      .select('id')
      .single()
  ).data.id;
  const memberA = await user('membera', ['ucsd']),
    headB = await user('headb', ['ucsd']),
    officer = await user('officer', ['officer']),
    exec = await user('exec', ['exec']),
    plain = await user('plain', ['ucsd']);
  await setRoles(memberA, [{ role: 'ucsd' }, { role: 'division_member', division_id: divA }]);
  await setRoles(headB, [{ role: 'ucsd' }, { role: 'division', division_id: divB }]);

  const tools = [
    { key: 'polls', list: '/api/polls', one: (r) => `/api/polls/${r.slug}`, pick: (j) => j.polls, make: (j) => j.poll },
    { key: 'qa', list: '/api/qa', one: (r) => `/api/qa/${r.slug}`, pick: (j) => j.sessions, make: (j) => j.session },
  ];
  for (const tool of tools) {
    const mine = await memberA.call('POST', tool.list, { name: `ZZ ${tool.key} A` });
    const row = tool.make(mine.j);
    t.ok(`a Division Member makes ${tool.key} for their division`, mine.s === 201 && row?.division_id === divA, JSON.stringify(mine));
    if (row?.id) made[tool.key].push(row.id);
    const club = await officer.call('POST', tool.list, { name: `ZZ ${tool.key} club` });
    t.ok(`an officer makes the club's ${tool.key}`, club.s === 201 && club.j && tool.make(club.j)?.division_id == null, JSON.stringify(club));
    const clubRow = tool.make(club.j);
    if (clubRow?.id) made[tool.key].push(clubRow.id);
    t.ok(`a Division Member cannot make ${tool.key} for another division`, (await memberA.call('POST', tool.list, { name: 'ZZ no', division_id: divB })).s === 403);
    const seen = (await memberA.call('GET', tool.list)).j;
    t.ok(`the Member's ${tool.key} list holds only their division's`, tool.pick(seen).every((x) => x.division_id === divA) && tool.pick(seen).some((x) => x.id === row.id));
    t.ok(`the officer's list does not show the division's`, !tool.pick((await officer.call('GET', tool.list)).j).some((x) => x.id === row.id));
    t.ok(`the Member opens their own`, (await memberA.call('GET', tool.one(row))).s === 200);
    t.ok(`the Member cannot open the club's`, (await memberA.call('GET', tool.one(clubRow))).s === 404);
    t.ok(`the officer cannot open the division's`, (await officer.call('GET', tool.one(row))).s === 404);
    t.ok(`another division's Head cannot open it`, (await headB.call('GET', tool.one(row))).s === 404);
    t.ok(`exec opens both`, (await exec.call('GET', tool.one(row))).s === 200 && (await exec.call('GET', tool.one(clubRow))).s === 200);
    t.ok(`a plain student is refused`, (await plain.call('GET', tool.list)).s === 403);
  }
  // Trivia quizzes
  const q = await memberA.call('POST', '/api/trivia/quizzes', { name: `ZZ quiz ${Date.now()}` });
  t.ok('a Division Member writes a quiz for their division', q.s === 201 && q.j.quiz?.division_id === divA, JSON.stringify(q));
  if (q.j.quiz?.id) made.quizzes.push(q.j.quiz.id);
  const qid = q.j.quiz?.id;
  t.ok('the officer does not see it in the list', !((await officer.call('GET', '/api/trivia/quizzes')).j.quizzes ?? []).some((x) => x.id === qid));
  t.ok('the officer cannot open it', (await officer.call('GET', `/api/trivia/quizzes/${qid}`)).s === 403);
  t.ok('the Member opens it', (await memberA.call('GET', `/api/trivia/quizzes/${qid}`)).s === 200);
  // Photo booths
  const b = await memberA.call('POST', '/api/photobooth/booths', { name: `ZZ booth ${Date.now()}` });
  t.ok('a Division Member sets up a booth for their division', b.s === 201, JSON.stringify(b));
  if (b.j.booth?.id) made.booths.push(b.j.booth.id);
  t.ok('the officer cannot open it', (await officer.call('GET', `/api/photobooth/booths/${b.j.booth?.slug}`)).s === 404);
  t.ok('the Member can', (await memberA.call('GET', `/api/photobooth/booths/${b.j.booth?.slug}`)).s === 200);
  t.ok('the officer’s booth list does not show it', !((await officer.call('GET', '/api/photobooth/booths')).j.booths ?? []).some((x) => x.id === b.j.booth?.id));
} finally {
  for (const id of made.polls) await svc.from('polls').delete().eq('id', id);
  for (const id of made.qa) await svc.from('qa_sessions').delete().eq('id', id);
  for (const id of made.quizzes) await svc.from('trivia_quizzes').delete().eq('id', id);
  for (const id of made.booths) await svc.from('photobooths').delete().eq('id', id);
  for (const id of [divA, divB]) if (id) await svc.from('divisions').delete().eq('id', id);
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
