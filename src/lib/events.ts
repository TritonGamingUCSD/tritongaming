import { openEventsFilter, endedEventsFilter } from '@/lib/checkinWindow';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import type { Event } from '@/types';
import type { SocialEmbed, PhotoAlbumEntry, ScheduleItem, EventSponsor } from '@/types/database';

const DEFAULT_LIMIT = 50;

// Public event lists/pages are cached briefly and shared between visitors
// (tag 'events', also invalidated when staff save an event). Fetchers throw on
// error so failures aren't cached; callers catch outside the cache.
const EVENTS_REVALIDATE_SECONDS = 60;
function cachedEvents<T>(keyParts: (string | number)[], fn: () => Promise<T>): Promise<T> {
  return unstable_cache(fn, ['events', ...keyParts.map(String)], { revalidate: EVENTS_REVALIDATE_SECONDS, tags: ['events'] })();
}

function mapSupabaseEvent(row: Record<string, unknown>): Event {
  return {
    _id: (row.id as string) ?? '',
    slug: (row.slug as string) ?? '',
    full_name: (row.title as string) ?? '',
    name: (row.name as string) ?? (row.title as string) ?? '',
    start_date: new Date(row.start_date as string).toISOString(),
    end_date: row.end_date ? new Date(row.end_date as string).toISOString() : '',
    flyer_url: (row.flyer_url as string) ?? '',
    location: (row.location as string) ?? '',
    content: (row.content as string) ?? '',
    details: (row.description as string) ?? '',
    url: (row.url as string) ?? '',
    requires_ticket: (row.requires_ticket as boolean) ?? false,
    ticket_price: (row.ticket_price as number) ?? 0,
    audience: (row.audience as 'public' | 'ucsd_only') ?? 'public',
    photo_albums: (row.photo_albums as PhotoAlbumEntry[]) ?? [],
    post_event_info: (row.post_event_info as string) ?? '',
    venue_address: (row.venue_address as string) ?? '',
    venue_notes: (row.venue_notes as string) ?? '',
    schedule: (row.schedule as ScheduleItem[]) ?? [],
    sponsors: (row.sponsors as EventSponsor[]) ?? [],
    social_embeds: (row.social_embeds as SocialEmbed[]) ?? [],
    points_value: (row.points_value as number) ?? 0,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getUpcomingEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    return await cachedEvents(['upcoming', limit], async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .or(openEventsFilter())
        .order('start_date', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(mapSupabaseEvent);
    });
  } catch {
    return [];
  }
}

export async function getPreviousEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    return await cachedEvents(['previous', limit], async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .or(endedEventsFilter())
        .order('start_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(mapSupabaseEvent);
    });
  } catch {
    return [];
  }
}

export async function getAllEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    return await cachedEvents(['all', limit], async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_published', true)
        .order('start_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []).map(mapSupabaseEvent);
    });
  } catch {
    return [];
  }
}

export async function getEventById(id: string): Promise<Event | null> {
  try {
    return await cachedEvents(['id', id], async () => {
      const supabase = createPublicClient();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? mapSupabaseEvent(data as Record<string, unknown>) : null;
    });
  } catch {
    return null;
  }
}

// Public event detail pages route on the (possibly null) editable slug, so
// this looks the param up as a slug first and falls back to id — a plain
// uuid param skips straight to the id lookup since it can never be a slug.
export async function getEventBySlugOrId(slugOrId: string): Promise<Event | null> {
  try {
    return await cachedEvents(['slug-or-id', slugOrId], async () => {
      const supabase = createPublicClient();
      const column = UUID_RE.test(slugOrId) ? 'id' : 'slug';
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq(column, slugOrId)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data ? mapSupabaseEvent(data as Record<string, unknown>) : null;
    });
  } catch {
    return null;
  }
}

// Public headcount for "N going" — aggregate only (see event_going_count in the
// event_details migration). Cached briefly like the rest of the public data.
export async function getGoingCount(eventId: string): Promise<number> {
  try {
    return await cachedEvents(['going', eventId], async () => {
      const { data, error } = await createPublicClient().rpc('event_going_count', { p_event_id: eventId });
      if (error) throw error;
      return (data as number) ?? 0;
    });
  } catch {
    return 0;
  }
}
