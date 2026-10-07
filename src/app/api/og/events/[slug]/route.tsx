import { eventOgResponse } from '@/lib/site/ogRoutes';

// The link-preview card for one event. The page points at it with a version in the address (?v=...) that changes whenever what the card shows changes.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return eventOgResponse(decodeURIComponent(slug));
}
