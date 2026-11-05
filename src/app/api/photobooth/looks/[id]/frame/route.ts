import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cleanFrameSpec } from '@/lib/photobooth/booth';
import { MAX_OVERLAY_BYTES, OVERLAY_BUCKET, authorizePhotoBooth, isWebp, loadLookFor, pathInBucket, removeUnusedOverlayFiles } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// A look's own frame (drawn over each photo; designed in the booth's studio).
//   PUT multipart { frame (WebP the page drew), design (JSON: border, words, logo...), logo? (WebP, when the logo is new) }   save it; the old frame (and a replaced logo) is removed
//   DELETE                                                                                                                  no frame any more
async function removeFiles(svc: SupabaseClient, urls: (string | null | undefined)[]) {
  const paths = urls.flatMap((u) => {
    const p = u ? pathInBucket(u, OVERLAY_BUCKET) : null;
    return p ? [p] : [];
  });
  if (paths.length)
    await svc.storage
      .from(OVERLAY_BUCKET)
      .remove(paths)
      .catch(() => undefined);
}

async function save(svc: SupabaseClient, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.size > MAX_OVERLAY_BYTES) return { error: 'That picture is too big (over 600 KB).', status: 413 };
  if (!isWebp(bytes)) return { error: 'The picture has to be a WebP file (the page makes it for you).', status: 415 };
  const path = `${crypto.randomUUID()}.webp`;
  const up = await svc.storage.from(OVERLAY_BUCKET).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000' });
  if (up.error) return { error: 'Couldn’t save the picture. Try again.', status: 500 };
  return { url: svc.storage.from(OVERLAY_BUCKET).getPublicUrl(path).data.publicUrl };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLookFor(auth, (await params).id);
  if (!found) return NextResponse.json({ error: 'That look is gone.' }, { status: 404 });
  const form = await request.formData().catch(() => null);
  const frame = form?.get('frame');
  const logo = form?.get('logo');
  let design: unknown = null;
  try {
    design = JSON.parse(String(form?.get('design') ?? '{}'));
  } catch {
    /* an unreadable design is the default one */
  }
  if (!(frame instanceof File)) return NextResponse.json({ error: 'There is no frame to save.' }, { status: 400 });
  const spec = cleanFrameSpec(design, found.look.frame.spec ?? undefined);
  const newFrame = await save(auth.svc, frame);
  if ('error' in newFrame) return NextResponse.json({ error: newFrame.error }, { status: newFrame.status });
  let logoUrl = spec.logoUrl;
  if (logo instanceof File) {
    const l = await save(auth.svc, logo);
    if ('error' in l) {
      await removeFiles(auth.svc, [newFrame.url]);
      return NextResponse.json({ error: l.error }, { status: l.status });
    }
    logoUrl = l.url;
  }
  if (logoUrl && logoUrl !== found.look.frame.spec?.logoUrl && !(logo instanceof File) && !logoUrl.includes(`/${OVERLAY_BUCKET}/`)) logoUrl = ''; // only a logo of ours is kept
  const stored = { ...spec, logoUrl };
  const { error } = await auth.svc.from('photobooth_looks').update({ frame_image: newFrame.url, frame_design: stored }).eq('id', found.look.id);
  if (error) {
    await removeFiles(auth.svc, [newFrame.url, logo instanceof File ? logoUrl : null]);
    return NextResponse.json({ error: 'Couldn’t save the frame. Try again.' }, { status: 500 });
  }
  await removeUnusedOverlayFiles(auth.svc, [
    found.look.frame.image,
    found.look.frame.spec?.logoUrl && found.look.frame.spec.logoUrl !== logoUrl ? found.look.frame.spec.logoUrl : null,
  ]);
  return NextResponse.json({ frame: { image: newFrame.url, spec: stored } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadLookFor(auth, (await params).id);
  if (!found) return NextResponse.json({ ok: true });
  await auth.svc.from('photobooth_looks').update({ frame_image: '', frame_design: null }).eq('id', found.look.id);
  await removeUnusedOverlayFiles(auth.svc, [found.look.frame.image, found.look.frame.spec?.logoUrl]);
  return NextResponse.json({ ok: true });
}
