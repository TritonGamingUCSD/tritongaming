import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeTrivia, findQuiz, quizGate, UUID } from '@/lib/trivia/server';
import { parseStorageUrl } from '@/lib/storage/imageUpload';

export const dynamic = 'force-dynamic';
export const MAX_IMAGE_BYTES = 250 * 1024; // the browser makes pictures about 120 KB; this is the most the server takes (the bucket refuses anything over 256 KB too)
const BUCKET = 'trivia-images';

/** Removes the stored pictures behind these addresses (the ones that are ours); a failure is not worth stopping for, the weekly tidy-up finds any left behind. */
export async function removeImages(svc: SupabaseClient, urls: (string | null | undefined)[]) {
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

// A WebP file starts with "RIFF", four size bytes, then "WEBP".
const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';

async function gate(id: string) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return { error: auth.error };
  const quiz = await findQuiz(auth.svc, id);
  if (!quiz) return { error: NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 }) };
  const lock = await quizGate(auth, quiz);
  if (lock) return { error: lock };
  return { auth, quiz };
}

// Set a question's picture: one WebP file (made small in the browser) as multipart form data with `question` (its id) and `file`. The old picture is removed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate((await params).id);
  if ('error' in g) return g.error;
  const { auth, quiz } = g;
  const form = await request.formData().catch(() => null);
  const qid = form?.get('question');
  const file = form?.get('file');
  if (typeof qid !== 'string' || !UUID.test(qid) || !(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'That picture is too big (over 250 KB after shrinking). Try a simpler one.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a WebP file (the page makes it for you).' }, { status: 415 });
  const { data: q } = await auth.svc.from('trivia_questions').select('id, image').eq('id', qid).eq('quiz_id', quiz.id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'That question is gone.' }, { status: 404 });
  const path = `${quiz.id}/${crypto.randomUUID()}.webp`;
  const up = await auth.svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  const url = auth.svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await auth.svc.from('trivia_questions').update({ image: url, updated_at: new Date().toISOString() }).eq('id', qid);
  if (error) {
    await removeImages(auth.svc, [url]);
    return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  }
  await removeImages(auth.svc, [q.image as string]);
  return NextResponse.json({ image: url });
}

// Take a question's picture away.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate((await params).id);
  if ('error' in g) return g.error;
  const { auth, quiz } = g;
  const b = await request.json().catch(() => ({}));
  if (typeof b.question !== 'string' || !UUID.test(b.question)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: q } = await auth.svc.from('trivia_questions').select('image').eq('id', b.question).eq('quiz_id', quiz.id).maybeSingle();
  if (!q) return NextResponse.json({ error: 'That question is gone.' }, { status: 404 });
  await auth.svc.from('trivia_questions').update({ image: '', updated_at: new Date().toISOString() }).eq('id', b.question);
  await removeImages(auth.svc, [q.image as string]);
  return NextResponse.json({ ok: true });
}
