import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { authorizeMeetings } from '@/lib/meetings/meetings';
import { EMOJI_NAME, MAX_EMOJI_BYTES, parseDiscordEmoji } from '@/lib/meetings/meetingFun';
import { hasCapability } from '@/lib/portal/capabilities';

export const dynamic = 'force-dynamic';

const BUCKET = 'custom-emojis';

const OUT_SIZE = 128;
const MAX_OUT_BYTES = 256 * 1024;

// Square crop, 128px, WebP (animation kept for GIFs and animated WebPs). Tries harder if the result is still big.
async function compress(bytes: Uint8Array): Promise<Buffer | null> {
  for (const quality of [80, 55, 35]) {
    const out = await sharp(bytes, { animated: true, limitInputPixels: 40_000_000 }).rotate()
      .resize(OUT_SIZE, OUT_SIZE, { fit: 'cover' }).webp({ quality, effort: 4 }).toBuffer();
    if (out.length <= MAX_OUT_BYTES) return out;
  }
  return null;
}

// Look at the first bytes, not the filename or the browser's claim.
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { ext: 'gif', type: 'image/gif' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: 'webp', type: 'image/webp' };
  return null;
}

async function authorizeAny() {
  const a = await authorizeMeetings('attend_meetings').catch(() => null);
  if (a && !a.error) return a;
  const h = await authorizeMeetings('host_meetings');
  return h;
}

// GET: the approved emojis (everyone), your own waiting ones, and for exec/admin the whole review queue.
export async function GET() {
  const auth = await authorizeAny();
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('custom_emojis').select('id, name, path, status, created_by, created_at').order('created_at', { ascending: false });
  const url = (p: string) => auth.svc.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
  const rows = data ?? [];
  const manage = hasCapability(auth.roles, 'manage_meetings');
  const row = (r: (typeof rows)[number]) => ({ id: r.id as string, name: r.name as string, url: url(r.path as string) });
  return NextResponse.json({
    manage,
    approved: rows.filter((r) => r.status === 'approved').map(row),
    mine: rows.filter((r) => r.status === 'pending' && r.created_by === auth.user.id).map(row),
    queue: manage ? rows.filter((r) => r.status === 'pending').map(row) : [],
  });
}

// POST (multipart: file, name): upload one. Exec/admin uploads go live straight away; anyone else's wait for approval.
export async function POST(request: Request) {
  const auth = await authorizeAny();
  if (auth.error) return auth.error;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const name = String(form?.get('name') ?? '').trim().toLowerCase().replace(/^:|:$/g, '');
  if (!EMOJI_NAME.test(name)) return NextResponse.json({ error: 'Name it with 2 to 20 letters, numbers or underscores, like pog_face.' }, { status: 400 });
  let bytes: Uint8Array;
  const pasted = String(form?.get('discord') ?? '').trim();
  if (pasted) {
    // An emoji copied from Discord: only Discord's own emoji address is ever fetched.
    const d = parseDiscordEmoji(pasted);
    if (!d) return NextResponse.json({ error: 'That doesn’t look like a Discord emoji. Paste the emoji itself or its link.' }, { status: 400 });
    const res = await fetch(`https://cdn.discordapp.com/emojis/${d.id}.${d.animated ? 'gif' : 'png'}?size=128&quality=lossless`, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res || !res.ok) return NextResponse.json({ error: 'Couldn’t get that emoji from Discord. Check that it still exists.' }, { status: 400 });
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_EMOJI_BYTES) return NextResponse.json({ error: 'That emoji is too big.' }, { status: 400 });
    bytes = buf;
  } else {
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image.' }, { status: 400 });
    if (file.size > MAX_EMOJI_BYTES) return NextResponse.json({ error: 'That image is too big. Try a smaller one.' }, { status: 400 });
    bytes = new Uint8Array(await file.arrayBuffer());
  }
  const kind = sniff(bytes);
  if (!kind) return NextResponse.json({ error: 'Use a PNG, JPG, GIF or WebP image.' }, { status: 400 });

  let small: Buffer | null;
  try { small = await compress(bytes); } catch { return NextResponse.json({ error: 'Couldn’t read that image.' }, { status: 400 }); }
  if (!small) return NextResponse.json({ error: 'That animation is too heavy. Try a shorter or smaller one.' }, { status: 400 });

  const manage = hasCapability(auth.roles, 'manage_meetings');
  if (!manage) {
    const { count } = await auth.svc.from('custom_emojis').select('id', { count: 'exact', head: true }).eq('created_by', auth.user.id).eq('status', 'pending');
    if ((count ?? 0) >= 3) return NextResponse.json({ error: 'You already have 3 waiting for approval. Wait for those first.' }, { status: 429 });
  }
  const { data: dupe } = await auth.svc.from('custom_emojis').select('id').ilike('name', name).maybeSingle();
  if (dupe) return NextResponse.json({ error: 'That name is taken. Pick another.' }, { status: 409 });

  const path = `${crypto.randomUUID()}.webp`;
  const { error: upErr } = await auth.svc.storage.from(BUCKET).upload(path, small, { contentType: 'image/webp', cacheControl: '31536000' });
  if (upErr) return NextResponse.json({ error: 'Couldn’t save the image.' }, { status: 500 });
  const { error } = await auth.svc.from('custom_emojis').insert({ name, path, status: manage ? 'approved' : 'pending', created_by: auth.user.id, reviewed_by: manage ? auth.user.id : null });
  if (error) { await auth.svc.storage.from(BUCKET).remove([path]); return NextResponse.json({ error: 'Couldn’t save it.' }, { status: 500 }); }
  return NextResponse.json({ ok: true, approved: manage });
}
