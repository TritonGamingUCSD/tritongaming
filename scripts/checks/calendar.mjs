// Checks, over HTTP against a running dev server with throwaway ZZ accounts: the portal calendar (who sees what, "mine"), the public calendar (only published, public things), the private feed link and the .ics files. Removes everything.
// Run (after the migration 20261107100000_calendar_feeds.sql is applied): node scripts/checks/calendar.mjs
import { svc, tracker, accounts, BASE } from './lib.mjs';

const t = tracker();
const { user, cleanup } = accounts('cal');
const ev = [];
const day = (n) => new Date(Date.now() - 8 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
try {
  const member = await user('member', ['ucsd']);
  const other = await user('other', ['ucsd']);
  const mk = async (name, n, extra = {}) => {
    const d = day(n);
    const r = await svc
      .from('events')
      .insert({
        title: `ZZ ${name}`,
        name: `ZZ ${name}`,
        slug: `zz-cal-${name.toLowerCase().replace(/\W+/g, '-')}-${Date.now() % 100000}`,
        start_date: d,
        end_date: d,
        is_published: true,
        audience: 'public',
        ticket_price: 0,
        location: 'ZZ Hall',
        ...extra,
      })
      .select('id')
      .single();
    ev.push(r.data?.id);
    return r.data?.id;
  };
  const pub = await mk('Public Night', 3);
  const draft = await mk('Draft Night', 4, { is_published: false });
  await svc.from('tickets').insert({ event_id: pub, user_id: member.id, source: 'free' });
  const from = day(0);
  const to = day(20);
  const P = `/api/calendar?from=${from}&to=${to}`;

  t.ok('the portal calendar needs a sign-in', (await fetch(BASE + P)).status === 401);
  const mine = await member.call('GET', P);
  const titles = (r) => (r.j.items ?? []).map((i) => i.title);
  t.ok('a member sees the public event', titles(mine).includes('ZZ Public Night'), JSON.stringify(titles(mine)));
  t.ok('and it is marked as theirs (they hold a ticket)', (mine.j.items ?? []).find((i) => i.title === 'ZZ Public Night')?.mine === true);
  t.ok('and not the draft', !titles(mine).includes('ZZ Draft Night'));
  const theirs = await other.call('GET', P);
  t.ok('someone without a ticket sees it but not as theirs', (theirs.j.items ?? []).find((i) => i.title === 'ZZ Public Night')?.mine !== true);
  t.ok('the quarters come along as terms', Array.isArray(mine.j.terms));

  const pubRes = await (await fetch(`${BASE}/api/calendar/public?from=${from}&to=${to}`)).json();
  const pt = (pubRes.items ?? []).map((i) => i.title);
  t.ok('the public calendar shows the public event', pt.includes('ZZ Public Night'));
  t.ok('and not the draft', !pt.includes('ZZ Draft Night'));
  t.ok(
    'and carries no "mine" marks',
    (pubRes.items ?? []).every((i) => !i.mine),
  );
  const bad = await fetch(`${BASE}/api/calendar/public?from=nonsense&to=junk`);
  t.ok('bad dates fall back instead of failing', bad.status === 200);
  const huge = await (await fetch(`${BASE}/api/calendar/public?from=2020-01-01&to=2030-01-01`)).json();
  t.ok('a huge range is cut short', (huge.items ?? []).length < 2000);

  const ics = await fetch(`${BASE}/api/calendar/public.ics`);
  const body = await ics.text();
  t.ok('the public .ics is a calendar file', ics.status === 200 && body.startsWith('BEGIN:VCALENDAR') && body.includes('ZZ Public Night'));
  t.ok('and leaves out the draft', !body.includes('ZZ Draft Night'));

  // the private feed link
  t.ok('no link at first', (await member.call('GET', '/api/calendar/feed')).j.url === null);
  t.ok('the feed needs a sign-in', (await fetch(`${BASE}/api/calendar/feed`)).status === 401);
  const made = await member.call('POST', '/api/calendar/feed');
  const link = made.j.url;
  t.ok('a link is made', /\/api\/calendar\/feed\/[0-9a-f]{48}\.ics$/.test(link ?? ''), JSON.stringify(made.j));
  t.ok('asking again gives the same link', (await member.call('POST', '/api/calendar/feed')).j.url === link);
  const feed = await fetch(BASE + new URL(link).pathname);
  const feedBody = await feed.text();
  t.ok('the link works without signing in', feed.status === 200 && feedBody.includes('BEGIN:VCALENDAR'));
  t.ok('and holds what is theirs', feedBody.includes('ZZ Public Night'));
  const fresh = await member.call('PUT', '/api/calendar/feed');
  t.ok('a new link replaces the old', fresh.j.url && fresh.j.url !== link);
  t.ok('the old link stops working', (await fetch(BASE + new URL(link).pathname)).status === 404);
  t.ok('the new one works', (await fetch(BASE + new URL(fresh.j.url).pathname)).status === 200);
  t.ok('a made-up link is refused', (await fetch(`${BASE}/api/calendar/feed/${'0'.repeat(48)}.ics`)).status === 404);
  await member.call('DELETE', '/api/calendar/feed');
  t.ok('turning it off kills the link', (await fetch(BASE + new URL(fresh.j.url).pathname)).status === 404);

  // the pages
  const pageHtml = await (await fetch(`${BASE}/calendar`)).text();
  t.ok('the public page loads', pageHtml.includes('Calendar'));
} finally {
  const ids = ev.filter(Boolean);
  if (ids.length) {
    await svc.from('tickets').delete().in('event_id', ids);
    await svc.from('events').delete().in('id', ids);
  }
  await svc.from('audit_log').delete().like('summary', '%ZZ %');
  await cleanup();
}
process.exit(t.result());
