import { NextResponse } from 'next/server';
import { slugify } from '@/lib/core/slug';
import { BOOTH_COLUMNS, RESERVED_SLUGS, authorizePhotoBooth } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// The booths (each is its own thing, not tied to an event).
//   GET                 every booth with how many pictures are waiting to be downloaded
//   POST { name }       make a booth with the default settings
export async function GET() {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const [{ data: booths }, { data: photos }] = await Promise.all([
    auth.svc.from('photobooths').select('id, slug, name, layout, created_at').order('created_at', { ascending: false }).limit(200),
    auth.svc.from('photobooth_photos').select('booth_id').gt('expires_at', new Date().toISOString()).limit(5000),
  ]);
  const count = new Map<string, number>();
  for (const p of photos ?? []) count.set(p.booth_id as string, (count.get(p.booth_id as string) ?? 0) + 1);
  return NextResponse.json({ booths: (booths ?? []).map((b) => ({ ...b, photos: count.get(b.id as string) ?? 0 })) });
}

export async function POST(request: Request) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : '';
  if (!name) return NextResponse.json({ error: 'Give the booth a name.' }, { status: 400 });
  let base = slugify(name).slice(0, 50) || 'booth';
  if (RESERVED_SLUGS.includes(base)) base = `${base}-booth`;
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await auth.svc.from('photobooths').insert({ slug, name, created_by: auth.user.id }).select(BOOTH_COLUMNS).single();
    if (data) return NextResponse.json({ booth: { id: data.id, slug: data.slug, name: data.name } }, { status: 201 });
    if (error?.code !== '23505') return NextResponse.json({ error: 'Couldn’t make that booth.' }, { status: 500 });
  }
  return NextResponse.json({ error: 'There is already a booth with that name.' }, { status: 409 });
}
