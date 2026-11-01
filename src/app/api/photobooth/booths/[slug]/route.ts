import { NextResponse } from 'next/server';
import { cleanBooth } from '@/lib/photobooth/booth';
import { OVERLAY_BUCKET, PHOTO_BUCKET, authorizePhotoBooth, loadBooth, overlaysByIds, pathInBucket } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// One booth, by its address word.
//   GET      its name, its settings, its frame and the stickers it offers
//   PUT      save the settings (every field is brought into range) and which overlays it offers; { name } too renames it
//   DELETE   remove the booth, its frame and every picture it took (the files too)
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  return NextResponse.json(found);
}

export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const config = cleanBooth(b, found.config);
  const overlays = await overlaysByIds(auth.svc, config.overlay_ids);
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : found.booth.name;
  if (!name) return NextResponse.json({ error: 'Give the booth a name.' }, { status: 400 });
  const row = { ...config, overlay_ids: overlays.map((o) => o.id), name, updated_at: new Date().toISOString() };
  const { error } = await auth.svc.from('photobooths').update(row).eq('id', found.booth.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save the booth. Try again.' }, { status: 500 });
  return NextResponse.json({ booth: { ...found.booth, name }, config: { ...config, overlay_ids: row.overlay_ids }, overlays });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ ok: true });
  const { data: photos } = await auth.svc.from('photobooth_photos').select('path').eq('booth_id', found.booth.id).limit(5000);
  const paths = (photos ?? []).map((p) => p.path as string);
  if (paths.length) await auth.svc.storage.from(PHOTO_BUCKET).remove(paths);
  await auth.svc.from('photobooths').delete().eq('id', found.booth.id); // its photo rows go with it
  const own = [found.frame.image, found.frame.spec?.logoUrl].flatMap((u) => (u && pathInBucket(u, OVERLAY_BUCKET) ? [pathInBucket(u, OVERLAY_BUCKET)!] : []));
  if (own.length) await auth.svc.storage.from(OVERLAY_BUCKET).remove(own);
  return NextResponse.json({ ok: true });
}
