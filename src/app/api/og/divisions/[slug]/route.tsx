import { divisionOgResponse } from '@/lib/site/ogRoutes';

// The link-preview card for one division. The page points at it with a version in the address (?v=...) that changes whenever what the card shows changes.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return divisionOgResponse(decodeURIComponent(slug));
}
