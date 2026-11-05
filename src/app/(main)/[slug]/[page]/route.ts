import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// /<division>/events, /team and /gallery of a division created since the last build (the build makes them show the division's pages; until then they are sent there). Anything else is a plain 404.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page } = await params;
  if (!['events', 'team', 'gallery'].includes(page)) notFound();
  const { data } = await createServiceClient().from('divisions').select('slug').eq('slug', slug).maybeSingle();
  if (!data) notFound();
  return NextResponse.redirect(new URL(`/divisions/${slug}/${page}`, request.url), 307);
}
