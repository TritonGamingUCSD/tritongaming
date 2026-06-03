import { NextResponse } from 'next/server';
import { getPreviousEvents } from '@/lib/events';

export async function GET() {
  try {
    const events = await getPreviousEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error('GET /api/events/previous error:', error);
    return NextResponse.json({ error: 'Failed to fetch previous events' }, { status: 500 });
  }
}
