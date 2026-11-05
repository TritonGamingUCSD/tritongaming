import { NextResponse } from 'next/server';
import { PHOTO_BUCKET, authorizePhotoBooth, loadBoothFor } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The pictures a booth still holds (they are deleted when their days are up), newest first, with how it is doing:
// GET → { photos: [{ id, token, url, gif, created_at, shared, hidden, downloads, animated }], stats: { total, gallery, hidden, downloads } }.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBoothFor(auth, (await params).slug);
  if (!found) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  const { data } = await auth.svc
    .from('photobooth_photos')
    .select('id, token, path, gif_path, shared, hidden, downloads, created_at')
    .eq('booth_id', found.booth.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(300);
  const rows = data ?? [];
  const photos = rows.map((p) => ({
    id: p.id as string,
    token: p.token as string,
    url: auth.svc.storage.from(PHOTO_BUCKET).getPublicUrl(p.path as string).data.publicUrl,
    gif: p.gif_path ? auth.svc.storage.from(PHOTO_BUCKET).getPublicUrl(p.gif_path as string).data.publicUrl : '',
    created_at: p.created_at as string,
    shared: !!p.shared,
    hidden: !!p.hidden,
    downloads: (p.downloads as number) ?? 0,
    animated: !!p.gif_path,
  }));
  return NextResponse.json({
    photos,
    stats: {
      total: photos.length,
      gallery: photos.filter((p) => p.shared && !p.hidden).length,
      hidden: photos.filter((p) => p.hidden).length,
      downloads: photos.reduce((n, p) => n + p.downloads, 0),
    },
  });
}
