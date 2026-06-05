import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/types';
import eventsJson from '@/data/events.json';

const DEFAULT_LIMIT = 50;

function mapSupabaseEvent(row: Record<string, unknown>): Event {
  return {
    _id: (row.id as string) ?? '',
    full_name: (row.title as string) ?? '',
    name: (row.name as string) ?? (row.title as string) ?? '',
    start_date: new Date(row.start_date as string).toISOString(),
    end_date: row.end_date ? new Date(row.end_date as string).toISOString() : '',
    flyer_url: (row.flyer_url as string) ?? '',
    location: (row.location as string) ?? '',
    content: (row.content as string) ?? '',
    url: (row.url as string) ?? '',
  };
}

export async function getUpcomingEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapSupabaseEvent);
  } catch {
    const all = eventsJson as Event[];
    return all
      .filter((e) => new Date(e.start_date) >= new Date())
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .slice(0, limit);
  }
}

export async function getPreviousEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .lt('start_date', new Date().toISOString())
      .order('start_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapSupabaseEvent);
  } catch {
    const all = eventsJson as Event[];
    return all
      .filter((e) => new Date(e.start_date) < new Date())
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .slice(0, limit);
  }
}

export async function getAllEvents(limit = DEFAULT_LIMIT): Promise<Event[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('start_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapSupabaseEvent);
  } catch {
    return (eventsJson as Event[]).slice(0, limit);
  }
}

export async function getEventById(id: string): Promise<Event | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? mapSupabaseEvent(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
