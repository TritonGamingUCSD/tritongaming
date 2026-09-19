import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildIcsEvent } from '@/lib/ics';

interface Params {
  params: Promise<{ id: string }>;
}

// Public — an event's own calendar file is exactly as public as the event
// page it's attached to (gated only by is_published, same as the page
// itself), no login required to download it.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, slug, title, description, content, location, start_date, end_date, is_published')
    .eq('id', id)
    .maybeSingle();

  if (!event || !event.is_published) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const ics = buildIcsEvent({
    uid: `event-${event.id}@tritongaming`,
    title: event.title,
    start: event.start_date,
    end: event.end_date,
    location: event.location,
    description: event.description ?? event.content,
    url: siteUrl && event.slug ? `${siteUrl}/events/${event.slug}` : null,
  });

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${(event.slug || event.id)}.ics"`,
    },
  });
}
