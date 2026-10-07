import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'pub';
process.env.VAPID_PRIVATE_KEY = 'priv';

const send = vi.fn();
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => send(...a) } }));

const deleted: string[] = [];
let subs: Record<string, unknown>[] = [];
let prefs: Record<string, unknown>[] = [];
vi.mock('@/lib/supabase/admin', () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({ in: async () => ({ data: table === 'push_subscriptions' ? subs : prefs }) }),
      delete: () => ({ eq: async (_c: string, id: string) => { deleted.push(id); return {}; } }),
    }),
  }),
}));

const { categoryOf, validPushEndpoint, pushNotifications } = await import('@/lib/notifications/webPush');
const sub = (id: string, user: string) => ({ id, user_id: user, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: 'k', auth: 'a' });

beforeEach(() => { send.mockReset(); send.mockResolvedValue({}); deleted.length = 0; subs = []; prefs = []; });

describe('what a notification is', () => {
  it('sorts types into the kinds a member can mute', () => {
    expect(categoryOf('meeting_invite')).toBe('meetings');
    expect(categoryOf('internal_event_reminder')).toBe('meetings');
    expect(categoryOf('ticket_confirmed')).toBe('events');
    expect(categoryOf('event_reminder')).toBe('events');
    expect(categoryOf('access_granted')).toBe('account');
    expect(categoryOf('help_ticket')).toBe('help');
    expect(categoryOf('storage_key')).toBe('keys');
    expect(categoryOf('something_new')).toBeNull();
  });
  it('only accepts real push services as a subscription address', () => {
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(validPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(validPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    // anything else would let a member make the server call an address of their choosing
    expect(validPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(validPushEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(validPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(validPushEndpoint('https://localhost/x')).toBe(false);
    expect(validPushEndpoint('https://169.254.169.254/latest/meta-data')).toBe(false);
    expect(validPushEndpoint(42)).toBe(false);
  });
});

describe('pushing notifications', () => {
  const row = (user: string, type = 'meeting_invite') => ({ user_id: user, type, title: 'Hi', body: 'There', href: '/portal' });

  it('sends to the devices of the people notified, and nobody else', async () => {
    subs = [sub('s1', 'u1'), sub('s2', 'u1'), sub('s3', 'u9')];
    const n = await pushNotifications([row('u1'), row('u2')]);
    expect(n).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(send.mock.calls[0][1]);
    expect(payload).toMatchObject({ title: 'Hi', body: 'There', url: '/portal', tag: 'meeting_invite' });
  });

  it('skips a kind the member muted, but always sends one that cannot be muted', async () => {
    subs = [sub('s1', 'u1')]; prefs = [{ user_id: 'u1', muted: ['meetings'] }];
    expect(await pushNotifications([row('u1', 'meeting_invite')])).toBe(0);
    expect(await pushNotifications([row('u1', 'event_reminder')])).toBe(1);
    expect(await pushNotifications([row('u1', 'security_notice')])).toBe(1);
  });

  it('forgets a device the push service says is gone, and never throws on other failures', async () => {
    subs = [sub('gone', 'u1'), sub('flaky', 'u1'), sub('ok', 'u1')];
    send.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith('/gone')) throw Object.assign(new Error('gone'), { statusCode: 410 });
      if (s.endpoint.endsWith('/flaky')) throw Object.assign(new Error('down'), { statusCode: 503 });
      return {};
    });
    expect(await pushNotifications([row('u1')])).toBe(1);
    expect(deleted).toEqual(['gone']);
  });

  it('does nothing when push is not set up', async () => {
    const key = process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_PRIVATE_KEY;
    subs = [sub('s1', 'u1')];
    expect(await pushNotifications([row('u1')])).toBe(0);
    expect(send).not.toHaveBeenCalled();
    process.env.VAPID_PRIVATE_KEY = key;
  });
});
