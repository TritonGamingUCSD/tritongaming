import { beforeAll, describe, expect, it } from 'vitest';
import { unsubscribeToken, unsubscribeUrl, verifyUnsubscribeToken } from './unsubscribe';

beforeAll(() => { process.env.EMAIL_LINK_SECRET = 'test-secret'; });

describe('opt-out link', () => {
  const user = '11111111-2222-3333-4444-555555555555';
  it('round-trips the person and the kind', () => {
    expect(verifyUnsubscribeToken(unsubscribeToken(user, 'updates'))).toEqual({ userId: user, kind: 'updates' });
  });
  it('refuses a changed, cut or made-up token', () => {
    const t = unsubscribeToken(user, 'reminders');
    expect(verifyUnsubscribeToken(`${t}x`)).toBeNull();
    expect(verifyUnsubscribeToken(t.slice(0, -3))).toBeNull();
    expect(verifyUnsubscribeToken('abc.def')).toBeNull();
    const [body] = t.split('.');
    expect(verifyUnsubscribeToken(`${body}.AAAA`)).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
  });
  it('makes an address on the site', () => {
    expect(unsubscribeUrl(user, 'newsletter')).toMatch(/^https:\/\/[^/]+\/api\/email\/unsubscribe\?t=/);
  });
});
