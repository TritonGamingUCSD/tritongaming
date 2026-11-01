import { NextResponse } from 'next/server';
import { UUID, authorizePhotoBooth, loadBooth, removeUnusedStickerFiles } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// DELETE   take a sticker off the booth (its picture file goes too, unless another booth's copy still uses it)
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { slug, id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const found = await loadBooth(auth.svc, slug);
  const cur = found?.overlays.find((o) => o.id === id);
  if (!cur) return NextResponse.json({ ok: true });
  await auth.svc.from('photobooth_overlays').delete().eq('id', id);
  await removeUnusedStickerFiles(auth.svc, [cur.image]);
  return NextResponse.json({ ok: true });
}
