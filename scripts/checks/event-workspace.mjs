// An event's workspace (/api/events/<id>/workspace): what is tied to the event, who sees which part, and tying a poll, Q&A, booth or Staffle to it. End to end against a running dev server as temporary "ZZ" accounts.
// Run: BASE_URL=http://localhost:3000 node scripts/checks/event-workspace.mjs
import { accounts, svc, tracker, BASE } from './lib.mjs';

const t = tracker();
const { user, cleanup, made } = accounts('workspace');
const hours = (n) => new Date(Date.now() + n * 3600e3).toISOString();
let evId;
try {
  const exec = await user('exec', ['exec']);
  const officer = await user('officer', ['officer']);
  const member = await user('member', ['ucsd']);
  const { data: ev } = await svc
    .from('events')
    .insert({ title: 'ZZ Workspace Event', slug: `zz-ws-${Date.now()}`, start_date: hours(-1), end_date: hours(2), points_value: 1, is_published: true })
    .select('id')
    .single();
  evId = ev.id;
  const W = `/api/events/${evId}/workspace`;

  t.ok('signed-out visitors are refused', (await fetch(`${BASE}${W}`)).status === 401);
  t.ok('an ordinary member is refused', (await member.call('GET', W)).s === 403);
  const e0 = await exec.call('GET', W);
  t.ok(
    'an exec sees every part',
    e0.s === 200 && e0.j.caps.details && e0.j.caps.email && e0.j.caps.polls && e0.j.caps.booths && e0.j.tickets && e0.j.tools.polls,
    JSON.stringify(e0.j.caps),
  );
  const o0 = await officer.call('GET', W);
  t.ok('an officer sees the live tools and checks, not the event’s details', o0.s === 200 && !o0.j.caps.details && o0.j.caps.polls, JSON.stringify(o0.j.caps));
  t.ok('an unknown event is a 404', (await exec.call('GET', '/api/events/00000000-0000-4000-8000-000000000000/workspace')).s === 404);

  // made for the event
  const poll = await exec.call('POST', '/api/polls', { name: 'ZZ WS Poll', event_id: evId });
  const qa = await exec.call('POST', '/api/qa', { name: 'ZZ WS QA', event_id: evId });
  const booth = await exec.call('POST', '/api/photobooth/booths', { name: 'ZZ WS Booth', config: {}, event_id: evId });
  const issue = await exec.call('POST', '/api/newsletter', { type: 'event_announcement', event_id: evId });
  t.ok('a poll, Q&A, booth and issue can be made for the event', poll.s === 201 && qa.s === 201 && booth.s === 201 && issue.s === 201);
  t.ok(
    'a poll for an event that does not exist is refused',
    (await exec.call('POST', '/api/polls', { name: 'ZZ WS Bad', event_id: '00000000-0000-4000-8000-000000000000' })).s === 404,
  );
  const e1 = await exec.call('GET', W);
  t.ok(
    'the workspace lists them',
    e1.j.tools.polls.some((x) => x.name === 'ZZ WS Poll') &&
      e1.j.tools.qa.some((x) => x.name === 'ZZ WS QA') &&
      e1.j.tools.booths.some((x) => x.name === 'ZZ WS Booth') &&
      e1.j.issues.length === 1,
    JSON.stringify(e1.j.tools),
  );

  // an existing poll tied on, and taken off
  const lone = await exec.call('POST', '/api/polls', { name: 'ZZ WS Lone Poll' });
  t.ok('a poll made for no event is not listed', !(await exec.call('GET', W)).j.tools.polls.some((x) => x.name === 'ZZ WS Lone Poll'));
  t.ok(
    'an existing poll can be tied to the event',
    (await exec.call('PUT', W, { kind: 'poll', id: lone.j.poll.id, on: true })).s === 200 && (await exec.call('GET', W)).j.tools.polls.some((x) => x.name === 'ZZ WS Lone Poll'),
  );
  t.ok(
    'and taken off again (the poll stays)',
    (await exec.call('PUT', W, { kind: 'poll', id: lone.j.poll.id, on: false })).s === 200 &&
      !(await exec.call('GET', W)).j.tools.polls.some((x) => x.name === 'ZZ WS Lone Poll') &&
      (await exec.call('GET', `/api/polls/${lone.j.poll.slug}`)).s === 200,
  );
  t.ok('a member cannot tie anything', (await member.call('PUT', W, { kind: 'poll', id: lone.j.poll.id, on: true })).s === 403);
  t.ok('a bad kind is refused', (await exec.call('PUT', W, { kind: 'nonsense', id: lone.j.poll.id, on: true })).s === 400);
  const rec = await exec.call('GET', '/api/events/recent');
  t.ok(
    'the event picker lists recent events, for the team only',
    rec.s === 200 && rec.j.events.some((x) => x.id === evId) && (await member.call('GET', '/api/events/recent')).s === 403,
  );

  // deleting the event keeps the tools
  await svc.from('events').delete().eq('id', evId);
  const { data: still } = await svc.from('polls').select('id, event_id').eq('name', 'ZZ WS Poll').single();
  t.ok('deleting the event only clears the link: the poll stays', !!still && still.event_id === null);
  evId = null;
} catch (e) {
  console.log('ERR', String(e).slice(0, 500));
  t.fail();
} finally {
  if (evId) await svc.from('events').delete().eq('id', evId);
  await svc.from('polls').delete().like('name', 'ZZ%');
  await svc.from('qa_sessions').delete().like('name', 'ZZ%');
  const { data: booths } = await svc.from('photobooths').select('id').like('name', 'ZZ%');
  for (const b of booths ?? []) await svc.from('photobooths').delete().eq('id', b.id);
  await svc.from('newsletter_issues').delete().like('title', '%ZZ Workspace%');
  await svc.from('audit_log').delete().in('actor_id', made);
  await svc.from('audit_log').delete().like('summary', '%ZZ%');
  await svc.from('notifications').delete().or('title.ilike.%ZZ%,body.ilike.%ZZ%');
  await cleanup();
  process.exit(t.result());
}
