import { calendarFeed } from '@/lib/events/calendarFeed';

export const dynamic = 'force-dynamic';

// The unified TG calendar subscription: all events and every non-private meeting. See lib/calendarFeed.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return calendarFeed(request, (await params).token, 'tg');
}
