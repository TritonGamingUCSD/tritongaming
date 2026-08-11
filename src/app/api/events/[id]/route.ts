import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const wantStats = url.searchParams.get('stats') === '1';

  try {
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (wantStats) {
      const supabase = await createClient();
      const [totalRes, checkedRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', id).neq('status', 'cancelled'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'used'),
      ]);
      return NextResponse.json({
        event,
        stats: {
          total: totalRes.count ?? 0,
          checked_in: checkedRes.count ?? 0,
        },
      });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error(`GET /api/events/${id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
