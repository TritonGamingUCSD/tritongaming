import { NextResponse } from 'next/server';
import { removeUnreferencedFiles } from '@/lib/storage/removeFiles';
import { POLL_BUCKET, UUID, authorizePolls, loadPollFor } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';
const MAX_IMAGE_BYTES = 250 * 1024; // the browser makes pictures about 120 KB; the bucket refuses anything over 256 KB too
const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';

async function find(slug: string, eid: string) {
  const auth = await authorizePolls('host');
  if (auth.error) return { error: auth.error } as const;
  const poll = await loadPollFor(auth, slug);
  if (!poll) return { error: NextResponse.json({ error: 'That poll is gone.' }, { status: 404 }) } as const;
  if (poll.status === 'revealed') return { error: NextResponse.json({ error: 'The results are already shown.' }, { status: 409 }) } as const;
  if (!UUID.test(eid)) return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) } as const;
  const { data: entry } = await auth.svc.from('poll_entries').select('id, image').eq('id', eid).eq('poll_id', poll.id).maybeSingle();
  if (!entry) return { error: NextResponse.json({ error: 'That entry is gone.' }, { status: 404 }) } as const;
  return { auth, poll, entry } as const;
}

// Set an entry's picture: one WebP file (made small in the browser) as multipart `file`. The old picture is removed.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string; eid: string }> }) {
  const { slug, eid } = await params;
  const f = await find(slug, eid);
  if ('error' in f) return f.error;
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'That picture is too big (over 250 KB after shrinking). Try a simpler one.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a WebP file (the page makes it for you).' }, { status: 415 });
  const path = `${f.poll.id}/${crypto.randomUUID()}.webp`;
  const up = await f.auth.svc.storage.from(POLL_BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const url = f.auth.svc.storage.from(POLL_BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await f.auth.svc.from('poll_entries').update({ image: url }).eq('id', eid);
  if (error) {
    await f.auth.svc.storage.from(POLL_BUCKET).remove([path]);
    return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  }
  await removeUnreferencedFiles(f.auth.svc, [f.entry.image as string]);
  return NextResponse.json({ image: url });
}

// Take an entry's picture away (and its file).
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; eid: string }> }) {
  const { slug, eid } = await params;
  const f = await find(slug, eid);
  if ('error' in f) return f.error;
  await f.auth.svc.from('poll_entries').update({ image: '' }).eq('id', eid);
  await removeUnreferencedFiles(f.auth.svc, [f.entry.image as string]);
  return NextResponse.json({ image: '' });
}
