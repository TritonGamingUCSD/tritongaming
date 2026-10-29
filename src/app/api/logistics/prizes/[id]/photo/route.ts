import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID } from '@/lib/logistics/planServer';
import { parseStorageUrl } from '@/lib/storage/imageUpload';
import { announce, stockTopic, whoIs } from '@/lib/logistics/live';

export const dynamic = 'force-dynamic';
const BUCKET = 'prize-photos';
const MAX_BYTES = 250 * 1024; // the browser makes it about 120 KB; this is the most the server takes (the bucket refuses over 256 KB too)

async function removePhotos(svc: SupabaseClient, urls: (string | null | undefined)[]) {
  const paths = urls.flatMap((u) => {
    const p = u ? parseStorageUrl(u) : null;
    return p && p.bucket === BUCKET ? [p.path] : [];
  });
  if (paths.length)
    await svc.storage
      .from(BUCKET)
      .remove(paths)
      .catch(() => undefined);
}
const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';

// One picture per prize: set it (a WebP file made small in the browser, as multipart `file`), or remove it. It shows on the prize's row and on a Staffle's card.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That picture is too big (over 250 KB after shrinking). Try a simpler one.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a WebP file (the page makes it for you).' }, { status: 415 });
  const { data: prize } = await auth.svc.from('logistics_prizes').select('id, photo').eq('id', id).maybeSingle();
  if (!prize) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
  const path = `${id}/${crypto.randomUUID()}.webp`;
  const up = await auth.svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const url = auth.svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await auth.svc.from('logistics_prizes').update({ photo: url, updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq('id', id);
  if (error) {
    await removePhotos(auth.svc, [url]);
    return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  }
  await removePhotos(auth.svc, [prize.photo as string]);
  await announce(stockTopic(), { k: 'prizes' }, await whoIs(auth.svc, auth.user.id));
  return NextResponse.json({ photo: url });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: prize } = await auth.svc.from('logistics_prizes').select('photo').eq('id', id).maybeSingle();
  if (!prize) return NextResponse.json({ error: 'That prize is gone.' }, { status: 404 });
  await auth.svc.from('logistics_prizes').update({ photo: '', updated_at: new Date().toISOString(), updated_by: auth.user.id }).eq('id', id);
  await removePhotos(auth.svc, [prize.photo as string]);
  await announce(stockTopic(), { k: 'prizes' }, await whoIs(auth.svc, auth.user.id));
  return NextResponse.json({ photo: '' });
}
