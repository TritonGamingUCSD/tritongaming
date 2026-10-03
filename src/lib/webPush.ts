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
  { id: 'help', label: 'Help inbox', hint: 'New questions that need an answer' },
] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number]['id'];

export function categoryOf(type: string): PushCategory | null {
  if (/^(meeting|internal_event)_/.test(type)) return 'meetings';
  if (/^(ticket_|event_|manual_award)/.test(type)) return 'events';
  if (/^(access_|role_)/.test(type)) return 'account';
  if (type === 'help_ticket') return 'help';
  return null;
}

// Only the real push services may be used as a subscription address: the server connects to it when sending, so an arbitrary address would let a
// member make the server call any web address.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try { const u = new URL(endpoint); return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname)); } catch { return false; }
}

let configured = false;
function setup() {
  if (configured) return;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const subject = process.env.VAPID_SUBJECT || (site.startsWith('https://') ? site : 'mailto:noreply@localhost.invalid');
  webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

export interface PushPayload { title: string; body?: string | null; url?: string | null; tag?: string }
interface Sub { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

const clip = (s: string | null | undefined, n: number) => (s ?? '').length > n ? `${(s ?? '').slice(0, n - 1)}…` : s ?? '';

// One send. A subscription the push service says is gone (404/410) is deleted so it is never tried again.
async function sendOne(svc: SupabaseClient, sub: Sub, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: clip(payload.title, 80), body: clip(payload.body, 180), url: payload.url || '/portal', tag: payload.tag }), { TTL: 86_400, timeout: 8000 });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await svc.from('push_subscriptions').delete().eq('id', sub.id);
    return false;
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
    await inBatches(jobs, 20, async (j) => { if (await sendOne(svc, j.sub, j.payload)) sent++; });
    return sent;
  } catch { return 0; }
}

export async function sendTestPush(userId: string): Promise<number> {
  if (!pushConfigured()) return 0;
  setup();
  const svc = createServiceClient();
  const { data: subs } = await svc.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').eq('user_id', userId);
  let sent = 0;
  await inBatches((subs ?? []) as Sub[], 10, async (s) => { if (await sendOne(svc, s, { title: 'Notifications are on', body: 'This is a test from Triton Gaming. You’ll get your reminders and invites like this.', url: '/portal', tag: 'test' })) sent++; });
  return sent;
}
