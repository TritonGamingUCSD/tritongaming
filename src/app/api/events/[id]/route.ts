import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/events';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error(`GET /api/events/${id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}
