import { NextResponse } from 'next/server';
import { getUpcomingEvents } from '@/lib/events';

export async function GET() {
  try {
    const events = await getUpcomingEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error('GET /api/events/upcoming error:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming events' }, { status: 500 });
  }
}
