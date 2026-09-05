import { createClient } from '@/lib/supabase/server';
import type { Event } from '@/types';

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
    return [];
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
    return [];
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
    return [];
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
