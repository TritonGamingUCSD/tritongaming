import { afterEach, describe, expect, it, vi } from 'vitest';
import { codeIsLive, cleanDestination, randomCode, PAGE_CODE } from '@/lib/pageCodes';
import { checkInWithCode } from '@/lib/checkin/anyCode';

describe('page code destinations', () => {
  it('accepts a path on this site and this site’s own full address', () => {
    expect(cleanDestination('/events/tgex-2026')).toBe('/events/tgex-2026');
    expect(cleanDestination('https://tritongaming.org/join?x=1#top')).toBe('/join?x=1#top');
    expect(cleanDestination('https://tritongaming.vercel.app/about')).toBe('/about');
  });
  it('refuses other sites, protocol tricks, the API and junk', () => {
    for (const bad of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', '/api/admin', '/auth/callback', 'events', '', '/a b', '/x"y', '/x\\y', 5, null]) {
      expect(cleanDestination(bad as unknown)).toBeNull();
    }
  });
});

describe('page codes', () => {
  it('are six digits', () => {
    expect(PAGE_CODE.test(randomCode())).toBe(true);
    expect(PAGE_CODE.test('12345')).toBe(false);
    expect(randomCode(() => 0)).toBe('000000');
  });
  it('are live only while on and before their end', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(codeIsLive({ is_active: true, expires_at: null }, now)).toBe(true);
    expect(codeIsLive({ is_active: false, expires_at: null }, now)).toBe(false);
    expect(codeIsLive({ is_active: true, expires_at: '2026-11-11T00:00:00Z' }, now)).toBe(true);
    expect(codeIsLive({ is_active: true, expires_at: '2026-11-09T00:00:00Z' }, now)).toBe(false);
  });
});

// The code box asks every question at once and reads the answers in order: a typed code must reach each kind, not stop at the first "no".
describe('what six typed digits become', () => {
  const answer = (map: Record<string, { status: number; body: object }>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const hit = Object.entries(map).find(([k]) => String(url).includes(k));
        const r = hit?.[1] ?? { status: 404, body: { error: 'no' } };
        return { ok: r.status < 300, status: r.status, json: async () => r.body };
      }),
    );
  afterEach(() => vi.unstubAllGlobals());
  it('a Trivia game’s code joins the game even though it is not a meeting or an online event', async () => {
    answer({ '/api/trivia/join': { status: 200, body: { ok: true } } });
    expect(await checkInWithCode('123456')).toEqual({ kind: 'trivia', code: '123456' });
  });
  it('a poll’s code opens the poll', async () => {
    answer({ '/api/polls/join': { status: 200, body: { id: 'p', name: 'x' } } });
    expect(await checkInWithCode('123456')).toEqual({ kind: 'poll', code: '123456' });
  });
  it('a page code takes the person to its page', async () => {
    answer({ '/api/page-codes/resolve': { status: 200, body: { href: '/join', label: 'Join' } } });
    expect(await checkInWithCode('123456')).toEqual({ kind: 'page', href: '/join', label: 'Join' });
  });
  it('a page code that has ended says so', async () => {
    answer({ '/api/page-codes/resolve': { status: 409, body: { error: 'That page code has ended.' } } });
    expect(await checkInWithCode('123456')).toEqual({ kind: 'error', message: 'That page code has ended.' });
  });
  it('a code nothing knows is an error', async () => {
    answer({});
    expect((await checkInWithCode('123456')).kind).toBe('error');
  });
});
