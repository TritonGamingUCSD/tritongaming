import { NextResponse } from 'next/server';
import { DEFAULT_BOOTH, cleanBooth, splitConfig } from '@/lib/photobooth/booth';
import { PHOTO_BUCKET, authorizePhotoBooth, loadBooth, removeUnusedOverlayFiles } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// One booth, by its address word.
//   GET      its name, its settings and its looks (each with its colours, frame and stickers)
//   PUT      save the booth's own settings (every field is brought into range); { name } too renames it (a look's colours are saved on the look)
//   DELETE   remove the booth, its looks and every picture it took (the files too)
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
  const config = splitConfig(cleanBooth(b, { ...DEFAULT_BOOTH, ...found.config })).settings;
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : found.booth.name;
  if (!name) return NextResponse.json({ error: 'Give the booth a name.' }, { status: 400 });
  const row = { ...config, name, updated_at: new Date().toISOString() };
  const { error } = await auth.svc.from('photobooths').update(row).eq('id', found.booth.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save the booth. Try again.' }, { status: 500 });
  return NextResponse.json({ booth: { ...found.booth, name }, config });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ ok: true });
  const { data: photos } = await auth.svc.from('photobooth_photos').select('path, gif_path').eq('booth_id', found.booth.id).limit(5000);
  const paths = (photos ?? []).flatMap((p) => [p.path as string, ...(p.gif_path ? [p.gif_path as string] : [])]);
  if (paths.length) await auth.svc.storage.from(PHOTO_BUCKET).remove(paths);
  const files = found.looks.flatMap((l) => [l.frame.image, l.frame.spec?.logoUrl, ...l.overlays.map((o) => o.image)]);
  await auth.svc.from('photobooths').delete().eq('id', found.booth.id); // its looks, stickers and photo rows go with it
  await removeUnusedOverlayFiles(auth.svc, files);
  return NextResponse.json({ ok: true });
}
