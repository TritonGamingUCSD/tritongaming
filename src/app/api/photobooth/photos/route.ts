import { NextResponse } from 'next/server';
import { expiresAt } from '@/lib/photobooth/booth';
import { photoToken } from '@/lib/photobooth/token';
import { MAX_PHOTO_BYTES, PHOTO_BUCKET, authorizePhotoBooth, isJpeg, isWebp, loadBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// A finished picture from the booth: multipart `booth` (the booth's address word) and `file` (a JPEG or WebP the booth made). It is kept for the booth's number of days (at most 7)
// and the answer is its token, which the booth turns into the QR code for /photos/<token>.
export async function POST(request: Request) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const form = await request.formData().catch(() => null);
  const key = form?.get('booth');
  const file = form?.get('file');
  if (typeof key !== 'string' || !(file instanceof File)) return NextResponse.json({ error: 'There is no picture to save.' }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'That picture is too big (over 2 MB).' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const jpeg = isJpeg(bytes);
  if (!jpeg && !isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a JPEG or WebP file.' }, { status: 415 });
  const booth = await loadBooth(auth.svc, key);
  if (!booth) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  const token = photoToken();
  const path = `${booth.booth.id}/${crypto.randomUUID()}.${jpeg ? 'jpg' : 'webp'}`;
  const up = await auth.svc.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: jpeg ? 'image/jpeg' : 'image/webp', cacheControl: '3600' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const { error } = await auth.svc
    .from('photobooth_photos')
    .insert({ token, booth_id: booth.booth.id, path, expires_at: expiresAt(new Date(), booth.config.keep_days).toISOString() });
  if (error) {
    await auth.svc.storage.from(PHOTO_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ token });
}
