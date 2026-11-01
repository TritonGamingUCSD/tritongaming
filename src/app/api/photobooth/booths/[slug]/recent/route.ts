import { NextResponse } from 'next/server';
import { PHOTO_BUCKET, authorizePhotoBooth, loadBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The latest pictures guests chose to share in this booth's gallery, for the booth's idle slideshow: GET → { photos: [{ url }] } (up to 12, newest first).
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  const { data } = await auth.svc
    .from('photobooth_photos')
    .select('path')
    .eq('booth_id', found.booth.id)
    .eq('shared', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(12);
  return NextResponse.json({ photos: (data ?? []).map((p) => ({ url: auth.svc.storage.from(PHOTO_BUCKET).getPublicUrl(p.path as string).data.publicUrl })) });
}
