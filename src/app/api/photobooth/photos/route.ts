import { guardFeature } from '@/lib/portal/featureGuard';
import { NextResponse } from 'next/server';
import { expiresAt } from '@/lib/photobooth/booth';
import { photoToken } from '@/lib/photobooth/token';
import { MAX_PHOTO_BYTES, PHOTO_BUCKET, authorizePhotoBooth, isGif, isJpeg, isWebp, loadBoothFor } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// A finished picture from the booth: multipart `booth` (the booth's address word), `file` (a JPEG or WebP the booth made) and optionally `gif` (the animated picture of the shots). It is kept for the booth's number of days (at most 7)
// and the answer is its token, which the booth turns into the QR code for /photos/<token>.
export async function POST(request: Request) {
  const off = await guardFeature('photobooth');
  if (off) return off;
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
  const gif = form?.get('gif');
  let gifBytes: Uint8Array | null = null;
  if (gif instanceof File) {
    if (gif.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'That animated picture is too big (over 2 MB).' }, { status: 413 });
    gifBytes = new Uint8Array(await gif.arrayBuffer());
    if (!isGif(gifBytes)) return NextResponse.json({ error: 'The animated picture has to be a GIF file.' }, { status: 415 });
  }
  const booth = await loadBoothFor(auth, key);
  if (!booth) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  const token = photoToken();
  const path = `${booth.booth.id}/${crypto.randomUUID()}.${jpeg ? 'jpg' : 'webp'}`;
  const up = await auth.svc.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: jpeg ? 'image/jpeg' : 'image/webp', cacheControl: '3600' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  // (the animated picture is a bonus: if it cannot be saved the picture still is)
  let gifPath: string | null = null;
  if (gifBytes) {
    const gp = `${booth.booth.id}/${crypto.randomUUID()}.gif`;
    const gu = await auth.svc.storage.from(PHOTO_BUCKET).upload(gp, gifBytes, { contentType: 'image/gif', cacheControl: '3600' });
    if (!gu.error) gifPath = gp;
  }
  const { error } = await auth.svc
    .from('photobooth_photos')
    .insert({ token, booth_id: booth.booth.id, path, gif_path: gifPath, shared: true, expires_at: expiresAt(new Date()).toISOString() });
  if (error) {
    await auth.svc.storage.from(PHOTO_BUCKET).remove(gifPath ? [path, gifPath] : [path]);
    return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ token });
}
