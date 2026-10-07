import { NextResponse } from 'next/server';
import { isLazySection, loadPortalSection } from '@/lib/portalSectionData';

export const dynamic = 'force-dynamic';

// GET /api/portal/section/<id>: the data for one heavy portal section, fetched when the section is first opened.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isLazySection(id)) return NextResponse.json({ error: 'Unknown section.' }, { status: 404 });
  try {
    const r = await loadPortalSection(id);
    if (r.status !== 200) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[portal section]', id, e);
    return NextResponse.json({ error: 'Couldn’t load that. Try again.' }, { status: 500 });
  }
}
