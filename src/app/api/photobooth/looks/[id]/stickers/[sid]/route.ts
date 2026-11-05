import { NextResponse } from 'next/server';
import { UUID, authorizePhotoBooth, loadLookFor, removeUnusedOverlayFiles } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// DELETE   take a sticker off the look (its picture file goes too, unless a copy still uses it)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const { id, sid } = await params;
  if (!UUID.test(sid)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const found = await loadLookFor(auth, id);
  const cur = found?.look.overlays.find((o) => o.id === sid);
  if (!cur) return NextResponse.json({ ok: true });
  await auth.svc.from('photobooth_overlays').delete().eq('id', sid);
  await removeUnusedOverlayFiles(auth.svc, [cur.image]);
  return NextResponse.json({ ok: true });
}
