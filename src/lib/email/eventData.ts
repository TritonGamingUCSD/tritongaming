import type { SupabaseClient } from '@supabase/supabase-js';
import { PACIFIC_TZ } from '@/lib/core/timezone';
import { siteUrl } from './template';

// What an email needs to know about an event (loaded from the event page when the email is made, so a change to the event shows), how its time is written, and the addresses of people (kept in auth.users). Used by the Newspaper.

export interface EventForEmail {
  title: string;
  start_date: string;
  end_date?: string | null;
  location: string | null;
  is_online: boolean;
  cover_url: string | null;
  slug?: string | null;
  // From the event page, all optional: shown only when the event has them.
  description?: string | null;
  venue_address?: string | null;
  venue_notes?: string | null;
  schedule?: { time: string; title: string }[];
  sponsors?: { name: string; url?: string }[];
  day_hours?: { day: string; start: string; end: string }[];
  audience?: string | null;
  ticket_price?: number | null;
  pageUrl?: string;
}
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: PACIFIC_TZ, ...o });

/** The pieces of the date block, in Pacific time: "SAT", "Oct 24", "3:00 PM". */
export function eventWhen(e: Pick<EventForEmail, 'start_date' | 'end_date'>) {
  const day = fmt(e.start_date, { weekday: 'short' }).toUpperCase();
  const date = fmt(e.start_date, { month: 'short', day: 'numeric' });
  const start = fmt(e.start_date, { hour: 'numeric', minute: '2-digit' });
  const end = e.end_date ? fmt(e.end_date, { hour: 'numeric', minute: '2-digit' }) : '';
  return { day, date, time: end && end !== start ? `${start} – ${end}` : start };
}

/** The description as a few plain lines: markdown marks removed, cut at a word, with "…" when cut. */
export function shortText(s: string | null | undefined, max = 280): string {
  const plain = String(s ?? '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max).replace(/\s+\S*$/, '');
  return `${cut}…`;
}

export async function loadEvent(svc: SupabaseClient, id: string): Promise<(EventForEmail & { id: string; is_published: boolean }) | null> {
  const { data } = await svc
    .from('events')
    .select(
      'id, title, start_date, end_date, location, venue_name, is_online, banner_url, flyer_url, slug, is_published, description, venue_address, venue_notes, schedule, sponsors, day_hours, audience, ticket_price',
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    title: data.title as string,
    start_date: data.start_date as string,
    end_date: data.end_date as string | null,
    is_published: !!data.is_published,
    location: ((data.venue_name as string | null) || (data.location as string | null)) ?? null,
    is_online: !!data.is_online,
    cover_url: ((data.flyer_url as string | null) || (data.banner_url as string | null)) ?? null,
    slug: data.slug as string | null,
    description: data.description as string | null,
    venue_address: data.venue_address as string | null,
    venue_notes: data.venue_notes as string | null,
    schedule: Array.isArray(data.schedule) ? (data.schedule as { time?: string; title?: string }[]).map((s) => ({ time: String(s.time ?? ''), title: String(s.title ?? '') })) : [],
    sponsors: Array.isArray(data.sponsors)
      ? (data.sponsors as { name?: string; url?: string }[]).map((s) => ({ name: String(s.name ?? ''), url: s.url ? String(s.url) : undefined })).filter((s) => s.name)
      : [],
    day_hours: Array.isArray(data.day_hours)
      ? (data.day_hours as { day?: string; start?: string; end?: string }[]).map((h) => ({ day: String(h.day ?? ''), start: String(h.start ?? ''), end: String(h.end ?? '') }))
      : [],
    audience: data.audience as string | null,
    ticket_price: data.ticket_price === null ? null : Number(data.ticket_price),
    pageUrl: `${siteUrl()}/events/${(data.slug as string | null) || id}`,
  };
}

// Addresses live in auth.users: read them a page at a time until every wanted person is found.
export async function authEmails(svc: SupabaseClient, want: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 20 && out.size < want.size; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const u of data.users) if (want.has(u.id) && u.email) out.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }
  return out;
}
