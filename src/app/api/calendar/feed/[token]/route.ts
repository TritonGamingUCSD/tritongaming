import { calendarFeed } from '@/lib/events/calendarFeed';

export const dynamic = 'force-dynamic';

// A person's private calendar subscription (what their portal Calendar shows). See lib/calendarFeed.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return calendarFeed(request, (await params).token, 'mine');
}
