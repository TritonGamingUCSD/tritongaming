import type { SupabaseClient } from '@supabase/supabase-js';
import { addDaysKey, pacificDayKey } from '@/lib/core/timezone';
import { getDivisions } from '@/lib/members/divisions';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { hasCapability, isVerifiedMember, type RoleGrant } from '@/lib/portal/capabilities';
import { canManageEvent } from '@/lib/events/eventAccess';
import { canManageTournament, canRunTournament } from '@/lib/tournaments/access';
import { canBeInactive, inactiveIds, loadQuarters, quarterName, type Quarter } from '@/lib/members/quarters';
import { isTgMember } from '@/lib/portal/capabilities';
import { collectBusyItems } from '@/lib/meetings/busyItems';
import { holidaysOf } from '@/lib/portal/countdowns';
import type { CalItem } from './types';

// Everything that can go on the calendar, gathered from the places it lives. The portal's version is for one signed-in person (only what they may see, with their own marked); the public version is only what is published for everyone. Items come back in no particular order.
export interface CalTerm {
  id: string;
  name: string;
  /** First and last day (inclusive), Pacific days. */
  start: string;
  end: string;
}
export interface CalendarData {
  items: CalItem[];
  /** The quarters touching the range, for the week numbers and the band above the calendar. */
  terms: CalTerm[];
}

const MAX_DAYS = 100;
const clampRange = (from: string, to: string, maxDays = MAX_DAYS) => {
  const end = to > addDaysKey(from, maxDays) ? addDaysKey(from, maxDays) : to;
  return { from, to: end, fromIso: new Date(`${addDaysKey(from, -1)}T00:00:00Z`).toISOString(), toIso: new Date(`${addDaysKey(end, 2)}T00:00:00Z`).toISOString() };
};
const overlaps = (start: string, end: string | null | undefined, fromIso: string, toIso: string) => start <= toIso && (end ?? start) >= fromIso;

/** The quarter dates as calendar items (when each begins and ends, and the break between) and as terms. Someone sitting this quarter out is told so on its first day. */
function termItems(quarters: Quarter[], from: string, to: string, opts: { sittingOut?: boolean; href?: string | null } = {}): CalendarData {
  const items: CalItem[] = [];
  const terms: CalTerm[] = [];
  const sorted = [...quarters].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  sorted.forEach((q, i) => {
    const name = quarterName(q);
    if (q.ends_on >= from && q.starts_on <= to) terms.push({ id: q.id, name, start: q.starts_on, end: q.ends_on });
    if (q.starts_on >= from && q.starts_on <= to)
      items.push({
        id: `term:${q.id}:start`,
        kind: 'term',
        title: `${name} begins`,
        start: q.starts_on,
        allDay: true,
        href: opts.href ?? null,
        note: opts.sittingOut && i === sorted.length - 1 ? 'You are sitting this quarter out' : null,
      });
    if (q.ends_on >= from && q.ends_on <= to) items.push({ id: `term:${q.id}:end`, kind: 'term', title: `${name} ends`, start: q.ends_on, allDay: true, href: opts.href ?? null });
    const next = sorted[i + 1];
    const breakStart = addDaysKey(q.ends_on, 1);
    if (next && next.starts_on > breakStart) {
      const breakEnd = addDaysKey(next.starts_on, -1);
      if (breakEnd >= from && breakStart <= to)
        items.push({ id: `term:${q.id}:break`, kind: 'term', title: 'Break', start: breakStart, end: breakEnd, allDay: true, note: `Back on ${next.starts_on}` });
    }
  });
  return { items, terms };
}

/** Holidays inside the range, as all-day items. */
function holidayItems(from: string, to: string): CalItem[] {
  const out: CalItem[] = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++)
    for (const h of holidaysOf(y)) if (h.day >= from && h.day <= to) out.push({ id: `holiday:${h.day}`, kind: 'holiday', title: h.name, start: h.day, allDay: true });
  return out;
}

export async function loadPortalCalendar(svc: SupabaseClient, user: { id: string }, roles: RoleGrant[], fromDay: string, toDay: string, maxDays?: number): Promise<CalendarData> {
  const { from, to, fromIso, toIso } = clampRange(fromDay, toDay, maxDays);
  const [off, divisions, { data: events }, { data: tickets }, { data: tourneys }, { data: entrantRows }, quarters, sitting] = await Promise.all([
    getOffSwitches(),
    getDivisions(),
    svc.from('events').select('id, slug, title, start_date, end_date, location, is_published, audience, division_id').lte('start_date', toIso).order('start_date').limit(300),
    svc.from('tickets').select('event_id').eq('user_id', user.id),
    svc
      .from('tournaments')
      .select('id, slug, name, division_id, status, starts_at, is_public')
      .not('starts_at', 'is', null)
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso)
      .limit(200),
    svc.from('tournament_entrants').select('tournament_id').eq('user_id', user.id),
    loadQuarters(svc),
    canBeInactive(roles) ? inactiveIds(svc) : Promise.resolve(new Set<string>()),
  ]);
  const divOf = new Map(divisions.map((d) => [d.id, d]));
  const items: CalItem[] = [];
  const verified = isVerifiedMember(roles);
  const ticketed = new Set((tickets ?? []).map((t) => t.event_id as string));

  // events: what is published for them (UCSD-only ones for UCSD people), plus drafts they manage
  for (const e of events ?? []) {
    const end = (e.end_date as string | null) ?? null;
    if (!overlaps(e.start_date as string, end, fromIso, toIso)) continue;
    const owner = { division_id: (e.division_id as string | null) ?? null };
    const manages = canManageEvent(roles, owner);
    if (!e.is_published && !manages) continue;
    if (e.is_published && e.audience === 'ucsd_only' && !verified && !manages) continue;
    const mine = ticketed.has(e.id as string);
    items.push({
      id: `event:${e.id}`,
      kind: 'event',
      title: e.title as string,
      start: e.start_date as string,
      end,
      allDay: false,
      divisionId: owner.division_id,
      mine,
      location: (e.location as string | null) ?? null,
      href: mine ? '/me/tickets' : manages ? `/portal/events/${e.id}` : `/events/${(e.slug as string | null) || e.id}`,
      note: !e.is_published ? 'Draft' : e.audience === 'ucsd_only' ? 'UCSD only' : null,
    });
  }

  // tournaments (public and not a draft, or ones they organize or play in)
  if (!off.includes('tournaments')) {
    const playing = new Set((entrantRows ?? []).map((r) => r.tournament_id as string));
    for (const t of tourneys ?? []) {
      const owner = { division_id: (t.division_id as string | null) ?? null };
      if (owner.division_id && off.includes('div_tournaments')) continue;
      const organizes = canRunTournament(roles, owner) || canManageTournament(roles, owner);
      const seen = (t.is_public && t.status !== 'draft') || organizes || playing.has(t.id as string);
      if (!seen) continue;
      const div = owner.division_id ? divOf.get(owner.division_id) : null;
      items.push({
        id: `tournament:${t.id}`,
        kind: 'tournament',
        title: t.name as string,
        start: t.starts_at as string,
        allDay: false,
        divisionId: owner.division_id,
        mine: organizes || playing.has(t.id as string),
        href: organizes ? (div ? `/portal/${div.slug}/tournaments/${t.slug}` : `/portal/tournaments/${t.slug}`) : `/tournaments/${t.slug}`,
        note: t.status === 'live' ? 'Live now' : t.status === 'draft' ? 'Draft' : null,
      });
    }
  }

  // streams (the schedule is public on the Watch page); their own roles are marked
  if (!off.includes('broadcast')) {
    const { data: crew } = await svc.from('broadcast_roles').select('broadcast_id').eq('user_id', user.id);
    const mineIds = new Set((crew ?? []).map((r) => r.broadcast_id as string));
    const { data: shows } = await svc
      .from('broadcasts')
      .select('id, title, starts_at, ends_at, status, division_id')
      .neq('status', 'cancelled')
      .gte('starts_at', fromIso)
      .lte('starts_at', toIso)
      .limit(200);
    for (const b of shows ?? []) {
      const div = b.division_id ? divOf.get(b.division_id as string) : null;
      if (b.division_id && off.includes('div_broadcast')) continue;
      items.push({
        id: `broadcast:${b.id}`,
        kind: 'broadcast',
        title: b.title as string,
        start: b.starts_at as string,
        end: (b.ends_at as string | null) ?? null,
        allDay: false,
        divisionId: (b.division_id as string | null) ?? null,
        mine: mineIds.has(b.id as string),
        href: div ? `/watch/${div.slug}` : '/watch',
        note: b.status === 'live' ? 'Live now' : null,
      });
    }
  }

  // meetings (the ones they are expected at or host) from the same place the planner reads them
  if (!off.includes('meetings') && isTgMember(roles)) {
    for (const m of await collectBusyItems(svc, user, roles, from, to).catch(() => [])) {
      if (m.kind !== 'meeting') continue;
      items.push({
        id: `meeting:${m.key ?? `${m.date}:${m.title}`}`,
        kind: 'meeting',
        title: m.title,
        start: m.start ?? m.date,
        end: m.end ?? null,
        allDay: !m.start,
        mine: true,
        location: m.location ?? null,
        href: m.href ?? '/portal/meetings',
        note: m.repeats ? 'Repeats' : null,
      });
    }
  }

  // event setups from Logistics
  if (!off.includes('logistics') && hasCapability(roles, 'view_logistics')) {
    const { data: plans } = await svc.from('logistics_plans').select('id, name, starts_on, ends_on, status').lte('starts_on', to).gte('ends_on', from).limit(100);
    for (const p of plans ?? []) {
      if (p.status === 'cancelled') continue;
      items.push({
        id: `logistics:${p.id}`,
        kind: 'logistics',
        title: p.name as string,
        start: p.starts_on as string,
        end: (p.ends_on as string | null) ?? (p.starts_on as string),
        allDay: true,
        href: '/portal/logistics',
        mine: false,
      });
    }
  }

  // deadlines: meeting plans they were asked to answer
  if (!off.includes('meetings') && isTgMember(roles)) {
    const { data: plans } = await svc
      .from('meeting_plans')
      .select('id, title, answer_by, audience, status')
      .eq('status', 'open')
      .gte('answer_by', from)
      .lte('answer_by', to)
      .limit(50);
    const mine = new Set(roles.map((r) => r.role as string));
    for (const p of plans ?? []) {
      const aud = (p.audience as string[] | null) ?? [];
      if (aud.length && !aud.some((a) => mine.has(a))) continue;
      items.push({
        id: `deadline:plan:${p.id}`,
        kind: 'deadline',
        title: `Answer by: ${p.title}`,
        start: p.answer_by as string,
        allDay: true,
        href: '/portal/meetings',
        mine: true,
      });
    }
  }

  const { items: termIt, terms } = termItems(quarters, from, to, { sittingOut: sitting.has(user.id), href: null });
  items.push(...termIt, ...holidayItems(from, to));
  return { items, terms };
}

/** What is published for everyone: events, public tournaments, streams, and the quarter dates. `divisionSlug` narrows it to one division's own things (and the club's shared dates). */
export async function loadPublicCalendar(svc: SupabaseClient, fromDay: string, toDay: string, divisionSlug?: string | null, maxDays?: number): Promise<CalendarData> {
  const { from, to, fromIso, toIso } = clampRange(fromDay, toDay, maxDays);
  const off = await getOffSwitches();
  const divisions = await getDivisions();
  const divOf = new Map(divisions.map((d) => [d.id, d]));
  const only = divisionSlug ? (divisions.find((d) => d.slug === divisionSlug)?.id ?? 'none') : null;
  const items: CalItem[] = [];
  const [{ data: events }, { data: tourneys }, { data: shows }, quarters] = await Promise.all([
    svc
      .from('events')
      .select('id, slug, title, start_date, end_date, location, audience, division_id')
      .eq('is_published', true)
      .lte('start_date', toIso)
      .order('start_date')
      .limit(300),
    off.includes('tournaments')
      ? Promise.resolve({ data: [] })
      : svc
          .from('tournaments')
          .select('id, slug, name, division_id, status, starts_at')
          .eq('is_public', true)
          .neq('status', 'draft')
          .not('starts_at', 'is', null)
          .gte('starts_at', fromIso)
          .lte('starts_at', toIso)
          .limit(200),
    off.includes('broadcast')
      ? Promise.resolve({ data: [] })
      : svc
          .from('broadcasts')
          .select('id, title, starts_at, ends_at, status, division_id')
          .in('status', ['scheduled', 'live'])
          .gte('starts_at', fromIso)
          .lte('starts_at', toIso)
          .limit(200),
    loadQuarters(svc),
  ]);
  const keep = (division: string | null | undefined) => (only === null ? true : division === only);
  for (const e of events ?? []) {
    if (!overlaps(e.start_date as string, (e.end_date as string | null) ?? null, fromIso, toIso) || !keep(e.division_id as string | null)) continue;
    items.push({
      id: `event:${e.id}`,
      kind: 'event',
      title: e.title as string,
      start: e.start_date as string,
      end: (e.end_date as string | null) ?? null,
      allDay: false,
      divisionId: (e.division_id as string | null) ?? null,
      location: (e.location as string | null) ?? null,
      href: `/events/${(e.slug as string | null) || e.id}`,
      note: e.audience === 'ucsd_only' ? 'UCSD only' : null,
    });
  }
  for (const t of (tourneys ?? []) as { id: string; slug: string; name: string; division_id: string | null; status: string; starts_at: string }[]) {
    if (t.division_id && off.includes('div_tournaments')) continue;
    if (!keep(t.division_id)) continue;
    items.push({
      id: `tournament:${t.id}`,
      kind: 'tournament',
      title: t.name,
      start: t.starts_at,
      allDay: false,
      divisionId: t.division_id,
      href: `/tournaments/${t.slug}`,
      note: t.status === 'live' ? 'Live now' : null,
    });
  }
  for (const b of (shows ?? []) as { id: string; title: string; starts_at: string; ends_at: string | null; status: string; division_id: string | null }[]) {
    if (b.division_id && off.includes('div_broadcast')) continue;
    if (!keep(b.division_id)) continue;
    const div = b.division_id ? divOf.get(b.division_id) : null;
    items.push({
      id: `broadcast:${b.id}`,
      kind: 'broadcast',
      title: b.title,
      start: b.starts_at,
      end: b.ends_at,
      allDay: false,
      divisionId: b.division_id,
      href: div ? `/watch/${div.slug}` : '/watch',
      note: b.status === 'live' ? 'Live now' : null,
    });
  }
  const { items: termIt, terms } = termItems(quarters, from, to);
  items.push(...termIt);
  return { items, terms };
}

export { pacificDayKey };
