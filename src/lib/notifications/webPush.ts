import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/admin';

// Web push: the same notifications as the bell, delivered to a member's browser or phone even when the portal isn't open. Members turn it on
// per device and can mute whole kinds of notification. Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (see README, "Web push").

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Kinds a member can mute. Anything not listed (a sign-in or security notice, say) is always sent.
export const PUSH_CATEGORIES = [
  { id: 'meetings', label: 'Meetings and planning', hint: 'Invites, reminders, and “when can you meet?” requests' },
  { id: 'events', label: 'Events and tickets', hint: 'Ticket confirmations, check-ins and event reminders' },
  { id: 'account', label: 'Account and access', hint: 'Role changes and access you’ve been given' },
  { id: 'points', label: 'Points and rewards', hint: 'Points you are given or lose, and rewards handed over or cancelled' },
  { id: 'logistics', label: 'Event logistics requests', hint: 'New equipment and prize requests and changes to them, for the logistics team' },
  { id: 'help', label: 'Help inbox', hint: 'New questions that need an answer' },
  { id: 'docs', label: 'Documentation', hint: 'Docs you are asked to read, and comments on your docs' },
  { id: 'admin', label: 'Admin alerts', hint: 'Risky actions by other admins, the free plan filling up, and scheduled jobs that fail' },
] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number]['id'];

export function categoryOf(type: string): PushCategory | null {
  if (/^meeting_/.test(type)) return 'meetings';
  if (/^(ticket_|event_|manual_award)/.test(type)) return 'events';
  if (/^(access_|role_)/.test(type)) return 'account';
  if (/^(points_|reward_)/.test(type)) return 'points';
  if (/^logistics_/.test(type)) return 'logistics';
  if (type === 'help_ticket') return 'help';
  if (type === 'audit_alert' || /^system_/.test(type)) return 'admin';
  if (type === 'doc_required' || type === 'doc_comment') return 'docs';
  return null;
}

// Only the real push services may be used as a subscription address: the server connects to it when sending, so an arbitrary address would let a
// member make the server call any web address.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

// The "subject" every push is signed with. Apple's push service is strict about it and answers 403 BadJwtToken to a local or placeholder address (localhost, .invalid),
// while Google's accepts anything, so a bad subject shows up as "works on Android, not on iPhone". Order: VAPID_SUBJECT (a mailto: address, a bare email, or an https address),
// then the site's own https address, then the club's public site.
const PUBLIC_SITE = 'https://tritongaming.org';
export function vapidSubject(env: Record<string, string | undefined> = process.env): string {
  const usable = (h: string) => !/^(localhost|127\.|.*\.invalid$|.*\.local$)/i.test(h);
  const own = (env.VAPID_SUBJECT ?? '').trim();
  if (own) {
    const email = own.replace(/^mailto:/i, '');
    if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) && usable(email.split('@')[1])) return `mailto:${email}`;
    try {
      const u = new URL(own);
      if (u.protocol === 'https:' && usable(u.hostname)) return u.origin;
    } catch {
      /* fall through */
    }
  }
  try {
    const u = new URL(env.NEXT_PUBLIC_SITE_URL ?? '');
    if (u.protocol === 'https:' && usable(u.hostname)) return u.origin;
  } catch {
    /* fall through */
  }
  return PUBLIC_SITE;
}

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails(vapidSubject(), process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
}
interface Sub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const clip = (s: string | null | undefined, n: number) => ((s ?? '').length > n ? `${(s ?? '').slice(0, n - 1)}…` : (s ?? ''));

// One send. A subscription the push service says is gone (404/410) is deleted so it is never tried again.
export interface SendResult {
  ok: boolean;
  status?: number;
  reason?: string;
}
async function sendOne(svc: SupabaseClient, sub: Sub, payload: PushPayload): Promise<SendResult> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: clip(payload.title, 80), body: clip(payload.body, 180), url: payload.url || '/portal', tag: payload.tag }),
      { TTL: 86_400, timeout: 8000 },
    );
    // When it last worked, so a member can see which of their devices still get notifications. Never allowed to turn a delivered push into a failure.
    try {
      await svc.from('push_subscriptions').update({ last_sent_at: new Date().toISOString() }).eq('id', sub.id);
    } catch {
      /* not important */
    }
    return { ok: true };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const code = err.statusCode;
    if (code === 404 || code === 410) await svc.from('push_subscriptions').delete().eq('id', sub.id);
    return { ok: false, status: code, reason: String(err.body || err.message || '').slice(0, 160) };
  }
}

async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

// Push the same things that were just put in the bell, to everyone who turned push on (and didn't mute that kind). Never throws, never
// blocks the request for long: a push problem must not break the thing that caused the notification.
export async function pushNotifications(rows: { user_id: string; type: string; title: string; body?: string | null; href?: string | null }[]): Promise<number> {
  if (!pushConfigured() || rows.length === 0) return 0;
  try {
    setup();
    const svc = createServiceClient();
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const [{ data: subs }, { data: prefs }] = await Promise.all([
      svc.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
      svc.from('push_preferences').select('user_id, muted').in('user_id', userIds),
    ]);
    if (!subs?.length) return 0;
    const muted = new Map((prefs ?? []).map((p) => [p.user_id as string, new Set((p.muted as string[]) ?? [])]));
    const jobs: { sub: Sub; payload: PushPayload }[] = [];
    for (const r of rows) {
      const cat = categoryOf(r.type);
      if (cat && muted.get(r.user_id)?.has(cat)) continue;
      for (const s of (subs as Sub[]).filter((x) => x.user_id === r.user_id)) jobs.push({ sub: s, payload: { title: r.title, body: r.body, url: r.href, tag: r.type } });
    }
    let sent = 0;
    await inBatches(jobs, 20, async (j) => {
      if ((await sendOne(svc, j.sub, j.payload)).ok) sent++;
    });
    return sent;
  } catch {
    return 0;
  }
}

// The test says what happened to each device (which push service, and why it was refused), so a silent failure can be found.
export interface TestResult {
  sent: number;
  devices: number;
  failed: { service: string; status?: number; reason?: string }[];
}
export async function sendTestPush(userId: string): Promise<TestResult> {
  if (!pushConfigured()) return { sent: 0, devices: 0, failed: [] };
  setup();
  const svc = createServiceClient();
  const { data: subs } = await svc.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', userId);
  const out: TestResult = { sent: 0, devices: (subs ?? []).length, failed: [] };
  await inBatches((subs ?? []) as Sub[], 10, async (s) => {
    const r = await sendOne(svc, s, {
      title: 'Notifications are on',
      body: 'This is a test from Triton Gaming. You’ll get your reminders and invites like this.',
      url: '/portal',
      tag: 'test',
    });
    if (r.ok) out.sent++;
    else out.failed.push({ service: new URL(s.endpoint).hostname.replace(/^(web|updates)\./, ''), status: r.status, reason: r.reason });
  });
  return out;
}
