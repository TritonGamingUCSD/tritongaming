import { NextResponse } from 'next/server';
import { cleanSticker, type Overlay } from '@/lib/photobooth/booth';
import { OVERLAY_BUCKET, OVERLAY_COLUMNS, UUID, authorizePhotoBooth, pathInBucket } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// One overlay.
//   PATCH { name?, x?, y?, size?, can_resize?, can_rotate? }   rename it or change a sticker's starting place, size and what a guest may do
//   DELETE                                                      remove it (and its picture) from the library and from every booth that offered it
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const { data: cur } = await auth.svc.from('photobooth_overlays').select(OVERLAY_COLUMNS).eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'That overlay is gone.' }, { status: 404 });
  const o = cur as Overlay;
  const patch: Record<string, unknown> = {};
  if (typeof b.name === 'string') {
    const name = b.name.trim().slice(0, 60);
    if (!name) return NextResponse.json({ error: 'Give the overlay a name.' }, { status: 400 });
    patch.name = name;
  }
  if (o.kind === 'sticker') Object.assign(patch, cleanSticker({ ...o, ...b }));
  const { data, error } = await auth.svc.from('photobooth_overlays').update(patch).eq('id', id).select(OVERLAY_COLUMNS).single();
  if (error) return NextResponse.json({ error: 'Couldn’t save. Try again.' }, { status: 500 });
  return NextResponse.json({ overlay: data as Overlay });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: cur } = await auth.svc.from('photobooth_overlays').select('image').eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ ok: true });
  // Every booth that offered it stops offering it.
  const { data: booths } = await auth.svc.from('photobooths').select('id, overlay_ids').contains('overlay_ids', [id]);
  for (const b of booths ?? [])
    await auth.svc
      .from('photobooths')
      .update({ overlay_ids: (b.overlay_ids as string[]).filter((x) => x !== id) })
      .eq('id', b.id);
  await auth.svc.from('photobooth_overlays').delete().eq('id', id);
  const path = pathInBucket(cur.image as string, OVERLAY_BUCKET);
  if (path) await auth.svc.storage.from(OVERLAY_BUCKET).remove([path]);
  return NextResponse.json({ ok: true });
}
