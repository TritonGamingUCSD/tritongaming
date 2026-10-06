import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

process.env.GOOGLE_CALENDAR_CLIENT_ID = 'id';
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'secret';
process.env.CALENDAR_TOKEN_KEY = crypto.randomBytes(32).toString('base64');

const g = await import('@/lib/googleCalendar');

// A tiny stand-in for the database client: calendar_connections rows in, updates ignored.
const fakeSvc = (rows: Record<string, unknown>[]) => ({
  from: () => ({
    select: () => ({ eq: () => ({ order: async () => ({ data: rows }) }) }),
    update: () => ({ eq: async () => ({}) }),
  }),
}) as never;

describe('tokens and scopes', () => {
  it('round-trips a refresh token and never stores it as plain text', () => {
    const enc = g.encryptToken('1//refresh-token');
    expect(enc).not.toContain('refresh-token');
    expect(g.decryptToken(enc)).toBe('1//refresh-token');
    // a stored value that was altered in any way fails to decrypt instead of returning something wrong
    const [iv, tag, body] = enc.split('.'); const bytes = Buffer.from(body, 'base64'); bytes[0] ^= 0xff;
    expect(() => g.decryptToken([iv, tag, bytes.toString('base64')].join('.'))).toThrow();
  });
  it('accepts only the view-only calendar permission', () => {
    expect(g.onlyViewScopes('openid email https://www.googleapis.com/auth/calendar.events.readonly')).toBe(true);
    expect(g.onlyViewScopes('https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/userinfo.email')).toBe(true);
    // a write permission anywhere in the grant is refused, and so is a grant with no calendar permission at all
    expect(g.onlyViewScopes('openid https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar')).toBe(false);
    expect(g.onlyViewScopes('openid email')).toBe(false);
  });
  it('reads the email from an id token', () => {
    const tok = `x.${Buffer.from(JSON.stringify({ email: 'a@b.com' })).toString('base64url')}.y`;
    expect(g.emailFromIdToken(tok)).toBe('a@b.com');
    expect(g.emailFromIdToken('nope')).toBeNull();
  });
});

describe('pulling events from several accounts', () => {
  const calls: { url: string; method: string }[] = [];
  beforeEach(() => { g.clearExternalCache(); calls.length = 0; });
  afterEach(() => vi.unstubAllGlobals());

  const conn = (id: string, email: string, show = true) => ({ id, user_id: 'u1', google_email: email, refresh_token_enc: g.encryptToken(`tok-${id}`), show_titles: show });
  const stub = (events: Record<string, unknown[]>, failToken: string[] = []) => vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET' });
    if (url.includes('oauth2.googleapis.com/token')) {
      const body = String(init?.body); const id = /tok-(\w+)/.exec(decodeURIComponent(body))?.[1] ?? '';
      return failToken.includes(id) ? new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }) : new Response(JSON.stringify({ access_token: `access-${id}` }), { status: 200 });
    }
    const who = (init?.headers as Record<string, string>).Authorization.replace('Bearer access-', '');
    return new Response(JSON.stringify({ items: events[who] ?? [] }), { status: 200 });
  }));

  const ev = (id: string, summary: string, extra: Record<string, unknown> = {}) => ({ id, iCalUID: `${id}@g`, summary, start: { dateTime: '2026-10-05T17:00:00-07:00' }, end: { dateTime: '2026-10-05T18:00:00-07:00' }, ...extra });

  it('merges every account, skips declined / free / cancelled, shows an invite on both accounts once, and only ever makes GET calls to the calendar API', async () => {
    stub({
      a: [ev('1', 'Lab'), ev('2', 'Declined', { attendees: [{ self: true, responseStatus: 'declined' }] }), ev('3', 'Free', { transparency: 'transparent' }), ev('4', 'Gone', { status: 'cancelled' }), ev('5', 'Invite')],
      b: [ev('6', 'Gym', { start: { dateTime: '2026-10-06T07:00:00-07:00' }, end: { dateTime: '2026-10-06T08:00:00-07:00' } }), ev('5', 'Invite')],
    });
    const r = await g.fetchExternalEvents(fakeSvc([conn('a', 'school@ucsd.edu'), conn('b', 'me@gmail.com')]), 'u1', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z');
    expect(r!.events.map((e) => e.title).sort()).toEqual(['Gym', 'Invite', 'Lab']);
    expect(r!.accounts.map((a) => a.error)).toEqual([null, null]);
    const calendarCalls = calls.filter((c) => c.url.includes('/calendar/v3/'));
    expect(calendarCalls.length).toBe(2);
    expect(calendarCalls.every((c) => c.method === 'GET')).toBe(true);
    expect(calls.filter((c) => !c.url.includes('/calendar/v3/') && !c.url.includes('oauth2.googleapis.com/token'))).toHaveLength(0);
  });

  it('one account losing access does not hide the others, and a hidden-title account shows only Busy', async () => {
    stub({ b: [ev('6', 'Secret dentist', { location: 'Clinic' })] }, ['a']);
    const r = await g.fetchExternalEvents(fakeSvc([conn('a', 'old@ucsd.edu'), conn('b', 'me@gmail.com', false)]), 'u1', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z');
    expect(r!.events).toHaveLength(1);
    expect(r!.events[0]).toMatchObject({ title: 'Busy', location: null, account: 'me@gmail.com' });
    expect(r!.accounts.find((a) => a.email === 'old@ucsd.edu')!.error).toBe('revoked');
    expect(r!.accounts.find((a) => a.email === 'me@gmail.com')!.error).toBeNull();
  });

  it('returns nothing when no account is linked', async () => {
    stub({});
    expect(await g.fetchExternalEvents(fakeSvc([]), 'u1', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z')).toBeNull();
  });
});

describe('when the Google keys are not set', () => {
  it('does nothing at all', async () => {
    const key = process.env.CALENDAR_TOKEN_KEY;
    delete process.env.CALENDAR_TOKEN_KEY;
    try {
      expect(g.googleConfigured()).toBe(false);
      const svc = { from: () => { throw new Error('should not even look at the database'); } } as never;
      expect(await g.fetchExternalEvents(svc, 'u1', '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z')).toBeNull();
    } finally { process.env.CALENDAR_TOKEN_KEY = key; }
  });
});
