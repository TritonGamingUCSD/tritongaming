import { NextResponse } from 'next/server';
import { cleanBooth } from '@/lib/photobooth/booth';
import { authorizePhotoBooth, loadLookFor, removeUnusedOverlayFiles } from '@/lib/photobooth/server';
import { LOOK_STYLE_KEYS } from '@/lib/photobooth/booth';

export const dynamic = 'force-dynamic';

// One look of a booth, by its id.
//   PUT { name?, style: { strip_bg, text_color, footer, filter } }   save its name and colours (every field is brought into range)
//   DELETE                                                          remove the look with its frame and stickers (a booth keeps at least one)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLookFor(auth, (await params).id);
  if (!found) return NextResponse.json({ error: 'That look is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 40) : found.look.name;
  if (!name) return NextResponse.json({ error: 'Give the look a name.' }, { status: 400 });
  const clean = cleanBooth({ ...found.look.style, ...(b.style ?? {}) });
  const style = Object.fromEntries(LOOK_STYLE_KEYS.map((k) => [k, clean[k]]));
  const { error } = await auth.svc
    .from('photobooth_looks')
    .update({ name, ...style })
    .eq('id', found.look.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save the look. Try again.' }, { status: 500 });
  return NextResponse.json({ name, style });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLookFor(auth, (await params).id);
  if (!found) return NextResponse.json({ ok: true });
  const { count } = await auth.svc.from('photobooth_looks').select('id', { count: 'exact', head: true }).eq('booth_id', found.boothId);
  if ((count ?? 0) <= 1) return NextResponse.json({ error: 'A booth needs at least one look.' }, { status: 409 });
  await auth.svc.from('photobooth_looks').delete().eq('id', found.look.id); // its stickers go with it
  await removeUnusedOverlayFiles(auth.svc, [found.look.frame.image, found.look.frame.spec?.logoUrl, ...found.look.overlays.map((o) => o.image)]);
  return NextResponse.json({ ok: true });
}
