import { NextResponse } from 'next/server';
import { MAX_STICKERS_PER_LOOK, cleanSticker, type Overlay } from '@/lib/photobooth/booth';
import { MAX_OVERLAY_BYTES, OVERLAY_BUCKET, OVERLAY_COLUMNS, authorizePhotoBooth, isWebp, loadLook } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// A look's own stickers (made in the studio: a picture, or words drawn on the website).
//   POST multipart { name, file (WebP), placements? (JSON: a place for each photo) }   add one (the page shrinks the picture and keeps its see-through parts)
//   PUT  { stickers: [{ id, name?, placements }] }          change where they sit, how big, how turned and on which photos; the order given is their order
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLook(auth.svc, (await params).id);
  if (!found) return NextResponse.json({ error: 'That look is gone.' }, { status: 404 });
  if (found.look.overlays.length >= MAX_STICKERS_PER_LOOK) return NextResponse.json({ error: `A look can have up to ${MAX_STICKERS_PER_LOOK} stickers.` }, { status: 409 });
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
  let placements: unknown = [];
  try {
    placements = JSON.parse(String(form?.get('placements') ?? '[]'));
  } catch {
    /* (unreadable: the default) */
  }
  const sticker = cleanSticker({ placements });
  const path = `${crypto.randomUUID()}.webp`;
  const up = await auth.svc.storage.from(OVERLAY_BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const image = auth.svc.storage.from(OVERLAY_BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await auth.svc
    .from('photobooth_overlays')
    .insert({ name, kind: 'sticker', image, ...sticker, look_id: found.look.id, booth_id: found.boothId, position: found.look.overlays.length, created_by: auth.user.id })
    .select(OVERLAY_COLUMNS)
    .single();
  if (error || !data) {
    await auth.svc.storage.from(OVERLAY_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Couldn’t save the sticker. Try again.' }, { status: 500 });
  }
  return NextResponse.json({ overlay: data as Overlay });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLook(auth.svc, (await params).id);
  if (!found) return NextResponse.json({ error: 'That look is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const items: Record<string, unknown>[] = Array.isArray(b.stickers) ? b.stickers : [];
  const mine = new Map(found.look.overlays.map((o) => [o.id, o]));
  let position = 0;
  for (const it of items) {
    const cur = typeof it.id === 'string' ? mine.get(it.id) : undefined;
    if (!cur) continue;
    const name = typeof it.name === 'string' && it.name.trim() ? it.name.trim().slice(0, 60) : cur.name;
    const { error } = await auth.svc
      .from('photobooth_overlays')
      .update({ name, ...cleanSticker({ ...cur, ...it }), position: position++ })
      .eq('id', cur.id);
    if (error) return NextResponse.json({ error: 'Couldn’t save the stickers. Try again.' }, { status: 500 });
  }
  const { data } = await auth.svc.from('photobooth_overlays').select(OVERLAY_COLUMNS).eq('look_id', found.look.id).order('position');
  return NextResponse.json({ overlays: (data ?? []) as Overlay[] });
}
