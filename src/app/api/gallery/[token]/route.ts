import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGallery } from '@/lib/photobooth/gallery';

export const dynamic = 'force-dynamic';

// A booth's public gallery, for the gallery page to refresh itself: GET → { name, accent, photos: [{ token, url }] }. No sign-in; the long random address is the key.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const g = await loadGallery(createServiceClient(), (await params).token);
  if (!g) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json(g, { headers: { 'Cache-Control': 'no-store' } });
}
