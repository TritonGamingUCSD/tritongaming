import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { TOKEN } from '@/lib/photobooth/token';
import { PHOTO_BUCKET } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The picture as a file to save (a "download" link to another address would only open it): the same picture the page shows, sent with a file name.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return new NextResponse('Not found', { status: 404 });
  const svc = createServiceClient();
  const { data } = await svc.from('photobooth_photos').select('path, expires_at').eq('token', token).maybeSingle();
  if (!data || new Date(data.expires_at as string).getTime() <= Date.now()) return new NextResponse('This photo is gone.', { status: 404 });
  const file = await svc.storage.from(PHOTO_BUCKET).download(data.path as string);
  if (file.error || !file.data) return new NextResponse('This photo is gone.', { status: 404 });
  const ext = (data.path as string).endsWith('.webp') ? 'webp' : 'jpg';
  return new NextResponse(file.data, {
    headers: {
      'Content-Type': ext === 'webp' ? 'image/webp' : 'image/jpeg',
      'Content-Disposition': `attachment; filename="triton-gaming-photo.${ext}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
