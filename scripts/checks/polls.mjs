// Polls (a contest or on-stage vote, voted on with a 6-digit code), end to end against a running dev server as temporary "ZZ" accounts, with the permissions checked for every kind of visitor.
// Everything made is deleted at the end (polls, their entries, votes and pictures go with them).
// Run: BASE_URL=http://localhost:3000 node scripts/checks/polls.mjs
import { createClient } from '@supabase/supabase-js';
import { accounts, svc, env, url, tracker, BASE } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('polls');
const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
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
  const member = await user('member', ['ucsd']); // signed in with an account, no officer permission
  const other = await user('other', ['officer']);
  const g1 = await guestUser();
  const g2 = await guestUser();
  const g3 = await guestUser();

  // ---- who may make and run polls
  t.ok('signed-out visitors cannot list or make polls', (await nobody('GET', '/api/polls')).s === 401 && (await nobody('POST', '/api/polls', { name: 'ZZ no' })).s === 401);
  t.ok(
    'an ordinary member cannot list or make polls',
    (await member.call('GET', '/api/polls')).s === 403 && (await member.call('POST', '/api/polls', { name: 'ZZ no' })).s === 403,
  );
  t.ok('a guest cannot list or make polls', (await g1.call('GET', '/api/polls')).s === 401 && (await g1.call('POST', '/api/polls', { name: 'ZZ no' })).s === 401);
  const mk = await host.call('POST', '/api/polls', { name: 'ZZ Poll Cosplay', mode: 'one', reveal: 'hidden' });
  t.ok('an officer makes a poll (a draft, no code yet)', mk.s === 201 && mk.j.poll?.status === 'draft' && mk.j.poll?.code === null, JSON.stringify(mk.j));
  const slug = mk.j.poll.slug;
  made.push(mk.j.poll.id);
  const P = `/api/polls/${slug}`;
  t.ok(
    'an ordinary member cannot see or change the poll',
    (await member.call('GET', P)).s === 403 && (await member.call('PATCH', P, { name: 'x' })).s === 403 && (await member.call('DELETE', P)).s === 403,
  );
  t.ok(
    'a guest cannot see or change the poll',
    (await g1.call('GET', P)).s === 401 && (await g1.call('PATCH', P, { action: 'open' })).s === 401 && (await g1.call('POST', `${P}/entries`, { name: 'x' })).s === 401,
  );
  t.ok('a bad name is refused', (await host.call('POST', '/api/polls', { name: '   ' })).s === 400);

  // ---- entries
  t.ok('an ordinary member cannot add entries', (await member.call('POST', `${P}/entries`, { name: 'ZZ nope' })).s === 403);
  const e1 = await host.call('POST', `${P}/entries`, { name: 'ZZ Link', subtitle: 'by Sam' });
  const e2 = await host.call('POST', `${P}/entries`, { name: 'ZZ Zelda' });
  t.ok('entries get the next numbers', e1.s === 201 && e2.s === 201 && e2.j.entries.map((e) => e.number).join() === '1,2', JSON.stringify(e2.j));
  t.ok('a number can’t be used twice', (await host.call('POST', `${P}/entries`, { name: 'ZZ Dup', number: 1 })).s === 409);
  const ids = e2.j.entries.map((e) => e.id);
  t.ok('an entry can be renamed', (await host.call('PATCH', `${P}/entries/${ids[0]}`, { name: 'ZZ Link Renamed' })).j.entries?.[0]?.name === 'ZZ Link Renamed');
  const form = new FormData();
  form.append('file', new File([webp], 'p.webp', { type: 'image/webp' }));
  const img = await fetch(`${BASE}${P}/entries/${ids[0]}/image`, { method: 'POST', headers: { cookie: host.cookie }, body: form });
  const imgJ = await img.json();
  t.ok('an entry can have a picture', img.ok && /poll-images/.test(imgJ.image), JSON.stringify(imgJ));
  const noForm = new FormData();
  noForm.append('file', new File([webp], 'p.webp', { type: 'image/webp' }));
  t.ok(
    'an ordinary member cannot upload a picture',
    (await fetch(`${BASE}${P}/entries/${ids[0]}/image`, { method: 'POST', headers: { cookie: member.cookie }, body: noForm })).status === 403,
  );
  const tiny = await host.call('POST', '/api/polls', { name: 'ZZ Poll Tiny' });
  made.push(tiny.j.poll.id);
  await host.call('POST', `/api/polls/${tiny.j.poll.slug}/entries`, { name: 'ZZ only' });
  t.ok('a poll cannot be opened with fewer than two entries', (await host.call('PATCH', `/api/polls/${tiny.j.poll.slug}`, { action: 'open' })).s === 409);

  // ---- nobody can vote before it is open
  t.ok(
    'a draft is invisible to voters',
    (await g1.call('GET', `/api/polls/play/${mk.j.poll.id}`)).s === 404 &&
      (await g1.call('POST', `/api/polls/play/${mk.j.poll.id}/vote`, { votes: [{ entry_id: ids[0], value: 1 }] })).s === 404,
  );

  // ---- open
  const op = await host.call('PATCH', P, { action: 'open' });
  const CODE = op.j.poll?.code;
  t.ok('opening gives a 6-digit code', op.s === 200 && /^[0-9]{6}$/.test(CODE) && op.j.poll.status === 'open', JSON.stringify(op.j.poll));
  t.ok(
    'the code is looked up without signing in, and says only what it is',
    (await nobody('GET', `/api/polls/lookup/${CODE}`)).j.poll === true && !JSON.stringify((await nobody('GET', `/api/polls/lookup/${CODE}`)).j).includes(ids[0]),
  );
  t.ok('an unknown code is not a poll', (await nobody('GET', '/api/polls/lookup/000000')).j.poll === false);
  t.ok(
    'the portal code box finds it (a member, then a guest)',
    (await member.call('POST', '/api/polls/join', { code: CODE })).s === 200 && (await g1.call('POST', '/api/polls/join', { code: CODE })).s === 200,
  );
  t.ok('a wrong code is 404', (await g1.call('POST', '/api/polls/join', { code: '000000' })).s === 404);
  t.ok(
    'the entries cannot change once voting is open',
    (await host.call('POST', `${P}/entries`, { name: 'ZZ late' })).s === 409 && (await host.call('DELETE', `${P}/entries/${ids[1]}`)).s === 409,
  );
  t.ok('the way to vote cannot change once voting is open', (await host.call('PATCH', P, { mode: 'score' })).s === 409);

  // ---- voting (guests and members)
  const play = (u) => u.call('GET', `/api/polls/play/${CODE}`);
  const s1 = await play(g1);
  t.ok('a voter sees the entries, no votes and no standings', s1.s === 200 && s1.j.entries.length === 2 && s1.j.mine.length === 0 && s1.j.standings === null, JSON.stringify(s1.j));
  const V = (u, pick) => u.call('POST', `/api/polls/play/${mk.j.poll.id}/vote`, { votes: pick === null ? [] : [{ entry_id: ids[pick], value: 1 }] });
  t.ok('a signed-out visitor cannot vote', (await nobody('POST', `/api/polls/play/${mk.j.poll.id}/vote`, { votes: [{ entry_id: ids[0], value: 1 }] })).s === 401);
  t.ok('a guest votes', (await V(g1, 0)).s === 200);
  t.ok('a second guest votes for the other entry', (await V(g2, 1)).s === 200);
  t.ok('a third guest votes for the first', (await V(g3, 0)).s === 200);
  t.ok('a member (with an account) votes too', (await V(member, 0)).s === 200);
  t.ok(
    'a vote can be changed: the old one is replaced, never added to',
    (await V(g2, 0)).s === 200 && (await g2.call('GET', `/api/polls/play/${mk.j.poll.id}`)).j.mine.length === 1,
  );
  t.ok(
    'an empty vote, two favourites, a stranger’s entry are refused',
    (await V(g1, null)).s === 400 &&
      (
        await g1.call('POST', `/api/polls/play/${mk.j.poll.id}/vote`, {
          votes: [
            { entry_id: ids[0], value: 1 },
            { entry_id: ids[1], value: 1 },
          ],
        })
      ).s === 400 &&
      (await g1.call('POST', `/api/polls/play/${mk.j.poll.id}/vote`, { votes: [{ entry_id: '00000000-0000-0000-0000-000000000000', value: 1 }] })).s === 400,
  );
  t.ok('a voter’s own vote shows, nobody else’s', (await g1.call('GET', `/api/polls/play/${mk.j.poll.id}`)).j.mine[0]?.entry_id === ids[0]);
  const host1 = await host.call('GET', P);
  t.ok(
    'the host sees live counts (4 voters, 4 for the first entry) even though the poll hides them',
    host1.j.voters === 4 && host1.j.standings[0].total === 4,
    JSON.stringify(host1.j.standings),
  );
  t.ok('voters still see no standings while it is open', (await g1.call('GET', `/api/polls/play/${mk.j.poll.id}`)).j.standings === null);

  // ---- close, reopen, reveal
  t.ok('an ordinary member cannot close it', (await member.call('PATCH', P, { action: 'close' })).s === 403);
  t.ok('another officer can run it (the poll is not private to its maker)', (await other.call('PATCH', P, { action: 'close' })).j.poll?.status === 'closed');
  t.ok('voting is refused once it is closed', (await V(g1, 1)).s === 409 && (await g1.call('POST', '/api/polls/join', { code: CODE })).s === 409);
  t.ok('a closed poll still shows no standings to voters', (await g1.call('GET', `/api/polls/play/${mk.j.poll.id}`)).j.standings === null);
  t.ok('it can be opened again and the vote still counts', (await host.call('PATCH', P, { action: 'reopen' })).j.poll?.status === 'open' && (await V(g3, 1)).s === 200);
  const rev = await host.call('PATCH', P, { action: 'reveal' });
  t.ok('revealing shows the results and gives the code back', rev.j.poll?.status === 'revealed' && rev.j.poll?.code === null);
  const after = await g1.call('GET', `/api/polls/play/${mk.j.poll.id}`);
  t.ok(
    'voters now see the standings (first entry 3 votes, second 1)',
    after.j.standings?.[0]?.total === 3 && after.j.standings?.[1]?.total === 1 && after.j.voters === 4,
    JSON.stringify(after.j),
  );
  t.ok('the code no longer opens the poll', (await g1.call('GET', `/api/polls/play/${CODE}`)).s === 404 && (await nobody('GET', `/api/polls/lookup/${CODE}`)).j.poll === false);
  t.ok('nobody can vote after the reveal', (await V(g1, 1)).s === 409);
  t.ok(
    'a revealed poll cannot be opened again or cleared',
    (await host.call('PATCH', P, { action: 'reopen' })).s === 409 && (await host.call('PATCH', P, { action: 'clear' })).s === 409,
  );

  // ---- top 3 and score polls
  const t3 = await host.call('POST', '/api/polls', { name: 'ZZ Poll Top3', mode: 'top3' });
  made.push(t3.j.poll.id);
  const T = `/api/polls/${t3.j.poll.slug}`;
  let tIds = [];
  for (const n of ['a', 'b', 'c', 'd']) tIds = (await host.call('POST', `${T}/entries`, { name: `ZZ ${n}` })).j.entries.map((e) => e.id);
  const tc = (await host.call('PATCH', T, { action: 'open' })).j.poll.code;
  const tv = (u, v) => u.call('POST', `/api/polls/play/${t3.j.poll.id}/vote`, { votes: v });
  t.ok(
    'top 3: a first, second and third choice',
    (
      await tv(g1, [
        { entry_id: tIds[0], value: 3 },
        { entry_id: tIds[1], value: 2 },
        { entry_id: tIds[2], value: 1 },
      ])
    ).s === 200,
  );
  t.ok(
    'top 3: two firsts are refused',
    (
      await tv(g2, [
        { entry_id: tIds[0], value: 3 },
        { entry_id: tIds[1], value: 3 },
      ])
    ).s === 400,
  );
  await tv(g2, [{ entry_id: tIds[1], value: 3 }]);
  const tr = (await host.call('GET', T)).j.standings;
  t.ok('top 3 points add up (a: 3, b: 2+3 = 5, c: 1)', tr[0].name === 'ZZ b' && tr[0].total === 5 && tr.find((x) => x.name === 'ZZ a').total === 3 && tc !== undefined);
  const sc = await host.call('POST', '/api/polls', { name: 'ZZ Poll Score', mode: 'score' });
  made.push(sc.j.poll.id);
  const S = `/api/polls/${sc.j.poll.slug}`;
  let sIds = [];
  for (const n of ['a', 'b']) sIds = (await host.call('POST', `${S}/entries`, { name: `ZZ ${n}` })).j.entries.map((e) => e.id);
  await host.call('PATCH', S, { action: 'open' });
  const sv = (u, v) => u.call('POST', `/api/polls/play/${sc.j.poll.id}/vote`, { votes: v });
  t.ok(
    'score: ratings 1 to 5',
    (
      await sv(g1, [
        { entry_id: sIds[0], value: 5 },
        { entry_id: sIds[1], value: 2 },
      ])
    ).s === 200 && (await sv(g2, [{ entry_id: sIds[0], value: 4 }])).s === 200,
  );
  t.ok('score: 6 is refused', (await sv(g3, [{ entry_id: sIds[0], value: 6 }])).s === 400);
  const sr = (await host.call('GET', S)).j.standings;
  t.ok('score: the average (a 4.5 from two, b 2 from one)', sr[0].total === 4.5 && sr[0].voters === 2 && sr[1].total === 2);

  // ---- clearing, deleting
  t.ok('the host can clear the votes of an open poll', (await host.call('PATCH', S, { action: 'clear' })).j.voters === 0);
  t.ok(
    'an open poll cannot be deleted; a closed one can',
    (await host.call('DELETE', S)).s === 409 && (await host.call('PATCH', S, { action: 'close' })).s === 200 && (await host.call('DELETE', S)).s === 200,
  );
  t.ok('an ordinary member cannot delete a poll', (await member.call('DELETE', P)).s === 403);
  const { data: left } = await svc.from('polls').select('id').eq('id', sc.j.poll.id);
  t.ok('the deleted poll is gone', (left ?? []).length === 0);
  const { data: pic } = await svc.from('poll_entries').select('image').eq('poll_id', mk.j.poll.id).not('image', 'eq', '');
  const picUrl = pic?.[0]?.image;
  const picPath = picUrl ? decodeURIComponent(picUrl.split('/poll-images/')[1]) : '';
  const listed = async () => ((await svc.storage.from('poll-images').list(picPath.slice(0, picPath.lastIndexOf('/')))).data ?? []).some((o) => picPath.endsWith(o.name));
  t.ok('the entry picture is in storage before the poll is deleted', !!picPath && (await listed()));
  t.ok('deleting the poll removes its entries’ pictures from storage too', (await host.call('DELETE', P)).s === 200 && !(await listed()));
} catch (e) {
  console.log('ERR', String(e).slice(0, 600));
  t.fail();
} finally {
  if (made.length) await svc.from('polls').delete().in('id', made);
  for (const id of guests) await svc.auth.admin.deleteUser(id).catch(() => undefined);
  await cleanup();
  const left = await svc.from('polls').select('id').like('name', 'ZZ Poll%');
  console.log('left polls', left.data?.length ?? '?');
  process.exit(t.result());
}
