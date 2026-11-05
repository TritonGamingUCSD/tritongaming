import { NextResponse } from 'next/server';
import { PHOTO_BUCKET, UUID, authorizePhotoBooth, loadBoothFor } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

async function find(slug: string, id: string) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return { error: auth.error } as const;
  if (!UUID.test(id)) return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) } as const;
  const found = await loadBoothFor(auth, slug);
  if (!found) return { error: NextResponse.json({ error: 'That booth is gone.' }, { status: 404 }) } as const;
  const { data } = await auth.svc.from('photobooth_photos').select('id, path, gif_path').eq('id', id).eq('booth_id', found.booth.id).maybeSingle();
  if (!data) return { error: NextResponse.json({ error: 'That picture is gone.' }, { status: 404 }) } as const;
  return { svc: auth.svc, photo: data as { id: string; path: string; gif_path: string | null } } as const;
}

// PATCH { hidden: boolean }   hide a picture from the gallery and the booth's slideshow (or show it again)
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const r = await find(slug, id);
  if ('error' in r) return r.error;
  const b = await request.json().catch(() => ({}));
  if (typeof b.hidden !== 'boolean') return NextResponse.json({ error: 'Say whether to hide it.' }, { status: 400 });
  const { error } = await r.svc.from('photobooth_photos').update({ hidden: b.hidden }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 });
  return NextResponse.json({ hidden: b.hidden });
}

// DELETE   delete a picture now (its files and its guest page go too)
export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const r = await find(slug, id);
  if ('error' in r) return r.error;
  const gone = await r.svc.storage.from(PHOTO_BUCKET).remove(r.photo.gif_path ? [r.photo.path, r.photo.gif_path] : [r.photo.path]);
  if (gone.error) return NextResponse.json({ error: 'Couldn’t remove the picture’s file. Try again.' }, { status: 500 }); // (the picture stays, so nothing is left behind)
  await r.svc.from('photobooth_photos').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
