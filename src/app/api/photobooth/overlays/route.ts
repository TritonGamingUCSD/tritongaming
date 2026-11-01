import { NextResponse } from 'next/server';
import { cleanSticker, type Overlay } from '@/lib/photobooth/booth';
import { MAX_OVERLAY_BYTES, OVERLAY_BUCKET, OVERLAY_COLUMNS, authorizePhotoBooth, isWebp } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The sticker library shared by every booth (a booth's frame is its own: see booths/[slug]/frame).
//   GET                                             all of them, newest first
//   POST multipart { name, file (WebP), x?, y?, size?, can_resize?, can_rotate? }    add a sticker (the page shrinks the picture and keeps its see-through parts)
export async function GET() {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('photobooth_overlays').select(OVERLAY_COLUMNS).order('created_at', { ascending: false }).limit(500);
  return NextResponse.json({ overlays: (data ?? []) as Overlay[] });
}

export async function POST(request: Request) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const form = await request.formData().catch(() => null);
  const name = String(form?.get('name') ?? '')
    .trim()
    .slice(0, 60);
  const file = form?.get('file');
  if (!name) return NextResponse.json({ error: 'Give the sticker a name.' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  if (file.size > MAX_OVERLAY_BYTES) return NextResponse.json({ error: 'That picture is too big (over 600 KB after shrinking). Try a simpler one.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a WebP file (the page makes it for you).' }, { status: 415 });
  const num = (k: string) => (form?.get(k) === null ? undefined : Number(form?.get(k)));
  const sticker = cleanSticker({ x: num('x'), y: num('y'), size: num('size'), can_resize: form?.get('can_resize') !== 'false', can_rotate: form?.get('can_rotate') !== 'false' });
  const path = `${crypto.randomUUID()}.webp`;
  const up = await auth.svc.storage.from(OVERLAY_BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const image = auth.svc.storage.from(OVERLAY_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await auth.svc
    .from('photobooth_overlays')
    .insert({ name, kind: 'sticker', image, ...sticker, created_by: auth.user.id })
    .select(OVERLAY_COLUMNS)
    .single();
  if (error || !data) {
    await auth.svc.storage.from(OVERLAY_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Couldn’t save the overlay. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ overlay: data as Overlay });
}
