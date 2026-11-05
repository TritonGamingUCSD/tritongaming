import { NextResponse } from 'next/server';
import { authorizeNewsletter, loadIssue } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';
const BUCKET = 'newsletter-images';
const MAX_IMAGE_BYTES = 384 * 1024; // the browser makes pictures of about 120 KB; the bucket refuses anything over 384 KB too
const isWebp = (b: Uint8Array) => b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';

// A picture for a block of a draft: one WebP file (made small in the browser) as multipart `file`. Answers with its public address, which the editor puts in the block. A picture that ends up in no block is removed by the weekly tidy-up.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  if (issue.status !== 'draft') return NextResponse.json({ error: 'Only a draft can change.' }, { status: 409 });
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture.' }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'That picture is too big after shrinking. Try a simpler one.' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'The picture has to be a WebP file (the page makes it for you).' }, { status: 415 });
  const path = `${issue.id}/${crypto.randomUUID()}.webp`;
  const up = await auth.svc.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return NextResponse.json({ error: 'Couldn’t save the picture. Try again.' }, { status: 500 });
  return NextResponse.json({ url: auth.svc.storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
}
