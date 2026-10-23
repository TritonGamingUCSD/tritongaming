import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { strictUser } from '@/lib/supabase/localAuth';
import { siteUrl } from './template';
import { EMAIL_COLUMNS, EMAIL_DAILY_LIMIT, wantsEmail, type EmailKind } from './prefs';
import { eventEmailHtml, eventEmailText, type EventForEmail } from './eventEmail';
import { unsubscribeUrl } from './unsubscribe';
import { sendOne } from './mailer';
import { senderForKind } from './senders';

export const BATCH = 40;   // how many emails one request sends (a serverless request is short); the page calls again for the next batch

/** Who may write and send event emails: admins, and anyone granted "Send event emails" (directly or through a group). */
export async function authorizeEventEmail() {
  const userClient = await createClient();
  const { data: { user } } = await strictUser(userClient);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!hasCapability(grants, 'send_event_emails')) return { error: NextResponse.json({ error: 'Only admins and people granted “Send event emails” can send event emails.' }, { status: 403 }) };
  return { user, svc };
}

export async function loadEvent(svc: SupabaseClient, id: string): Promise<(EventForEmail & { id: string; is_published: boolean }) | null> {
  const { data } = await svc.from('events').select('id, title, start_date, end_date, location, venue_name, is_online, banner_url, flyer_url, slug, is_published, description, venue_address, venue_notes, schedule, sponsors, day_hours, audience, ticket_price').eq('id', id).maybeSingle();
  if (!data) return null;
  return { id: data.id as string, title: data.title as string, start_date: data.start_date as string, end_date: data.end_date as string | null, is_published: !!data.is_published,
    location: ((data.venue_name as string | null) || (data.location as string | null)) ?? null, is_online: !!data.is_online, cover_url: ((data.flyer_url as string | null) || (data.banner_url as string | null)) ?? null, slug: data.slug as string | null,
    description: data.description as string | null, venue_address: data.venue_address as string | null, venue_notes: data.venue_notes as string | null,
    schedule: Array.isArray(data.schedule) ? (data.schedule as { time?: string; title?: string }[]).map((s) => ({ time: String(s.time ?? ''), title: String(s.title ?? '') })) : [],
    sponsors: Array.isArray(data.sponsors) ? (data.sponsors as { name?: string; url?: string }[]).map((s) => ({ name: String(s.name ?? ''), url: s.url ? String(s.url) : undefined })).filter((s) => s.name) : [],
    day_hours: Array.isArray(data.day_hours) ? (data.day_hours as { day?: string; start?: string; end?: string }[]).map((h) => ({ day: String(h.day ?? ''), start: String(h.start ?? ''), end: String(h.end ?? '') })) : [],
    audience: data.audience as string | null, ticket_price: data.ticket_price === null ? null : Number(data.ticket_price), pageUrl: `${siteUrl()}/events/${(data.slug as string | null) || id}` };
}

export interface Person { id: string; name: string; email: string; ticketId: string }
export interface Audience { people: Person[]; ticketHolders: number; skippedOptOut: number; skippedNoEmail: number }

/** The people to email for an event: everyone with an active ticket (one email each), minus those who opted out of this kind (or of all club emails) and those with no address. Sorted by id so a
 *  batch cursor stays put between calls. */
export async function audienceFor(svc: SupabaseClient, eventId: string, kind: EmailKind): Promise<Audience> {
  const { data: tickets } = await svc.from('tickets').select('id, user_id').eq('event_id', eventId).eq('status', 'active').limit(5000);
  const byUser = new Map<string, string>();
  for (const t of tickets ?? []) if (!byUser.has(t.user_id as string)) byUser.set(t.user_id as string, t.id as string);
  const ids = [...byUser.keys()].sort();
  if (!ids.length) return { people: [], ticketHolders: 0, skippedOptOut: 0, skippedNoEmail: 0 };
  const [{ data: profiles }, emails] = await Promise.all([
    svc.from('profiles').select(`id, display_name, preferred_email, ${EMAIL_COLUMNS.join(', ')}`).in('id', ids),
    authEmails(svc, new Set(ids)),
  ]);
  const prof = new Map((profiles ?? []).map((p) => [(p as unknown as { id: string }).id, p as unknown as Record<string, unknown>]));
  const people: Person[] = [];
  let skippedOptOut = 0, skippedNoEmail = 0;
  for (const id of ids) {
    const p = prof.get(id) ?? {};
    if (!wantsEmail(p, kind)) { skippedOptOut++; continue; }
    const email = (typeof p.preferred_email === 'string' && p.preferred_email.includes('@') ? p.preferred_email : emails.get(id)) ?? '';
    if (!email) { skippedNoEmail++; continue; }
    people.push({ id, name: (p.display_name as string | null) || 'there', email, ticketId: byUser.get(id)! });
  }
  return { people, ticketHolders: ids.length, skippedOptOut, skippedNoEmail };
}

// Addresses live in auth.users: read them a page at a time until every wanted person is found.
async function authEmails(svc: SupabaseClient, want: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 20 && out.size < want.size; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) if (want.has(u.id) && u.email) out.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return out;
}

/** How many event emails went out in the last 24 hours, against the daily limit. */
export async function sentLastDay(svc: SupabaseClient): Promise<number> {
  const { data } = await svc.from('event_emails').select('sent').gte('sent_at', new Date(Date.now() - 24 * 3600_000).toISOString());
  return (data ?? []).reduce((n, r) => n + ((r.sent as number) ?? 0), 0);
}
export const quotaLeft = (used: number) => Math.max(0, EMAIL_DAILY_LIMIT - used);

export function renderFor(opts: { event: EventForEmail; kind: EmailKind; subject: string; note: string; person: { id: string; ticketId: string | null }; test?: boolean; logoSrc?: string; showCover?: boolean }) {
  const site = siteUrl();
  const unsub = unsubscribeUrl(opts.person.id, opts.kind);
  const o = { event: opts.event, kind: opts.kind, subject: opts.subject, note: opts.note, ticketUrl: opts.person.ticketId ? `${site}/portal/tickets?qr=${opts.person.ticketId}` : `${site}/portal/tickets`, unsubscribeUrl: unsub, settingsUrl: `${site}/portal/profile`, test: opts.test, logoSrc: opts.logoSrc, showCover: opts.showCover };
  return { html: eventEmailHtml(o), text: eventEmailText(o), unsubscribeUrl: unsub };
}

/** Sends the next batch of an event email (the people at positions `from` .. `from + BATCH` of the audience) and adds what happened to the send's record. */
export async function sendBatch(svc: SupabaseClient, send: { id: string; event_id: string; kind: EmailKind; subject: string; note: string | null; cover: boolean }, from: number) {
  const event = await loadEvent(svc, send.event_id);
  if (!event) return { error: 'That event is gone.' as const };
  const { people } = await audienceFor(svc, send.event_id, send.kind);
  const slice = people.slice(from, from + BATCH);
  let sent = 0, failed = 0;
  for (const p of slice) {
    const r = renderFor({ event, kind: send.kind, subject: send.subject, note: send.note ?? '', person: { id: p.id, ticketId: p.ticketId }, showCover: send.cover });
    const res = await sendOne({ to: p.email, subject: send.subject, text: r.text, html: r.html, sender: senderForKind(send.kind), unsubscribeUrl: r.unsubscribeUrl });
    if (res.ok) sent++; else failed++;
  }
  const { data: row } = await svc.from('event_emails').select('sent, failed').eq('id', send.id).maybeSingle();
  await svc.from('event_emails').update({ sent: ((row?.sent as number) ?? 0) + sent, failed: ((row?.failed as number) ?? 0) + failed }).eq('id', send.id);
  return { done: from + slice.length >= people.length, next: from + slice.length, total: people.length, sent, failed };
}
