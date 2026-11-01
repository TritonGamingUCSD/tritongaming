import { NextResponse } from 'next/server';
import { MAX_LOOKS_PER_BOOTH } from '@/lib/photobooth/booth';
import { authorizePhotoBooth, loadBooth } from '@/lib/photobooth/server';
import { copyLook } from '@/lib/photobooth/looks';

export const dynamic = 'force-dynamic';

// POST { name?, from? }   add a look to the booth: a copy of the look `from` (its id), or else a plain one. Up to 6 looks.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const found = await loadBooth(auth.svc, (await params).slug);
  if (!found) return NextResponse.json({ error: 'That booth is gone.' }, { status: 404 });
  if (found.looks.length >= MAX_LOOKS_PER_BOOTH) return NextResponse.json({ error: `A booth can offer up to ${MAX_LOOKS_PER_BOOTH} looks.` }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const source = typeof b.from === 'string' ? found.looks.find((l) => l.id === b.from) : undefined;
  const name = (typeof b.name === 'string' && b.name.trim() ? b.name.trim() : source ? `${source.name} copy` : `Look ${found.looks.length + 1}`).slice(0, 40);
  const look = await copyLook(auth.svc, { boothId: found.booth.id, position: found.looks.length, name, source, userId: auth.user.id });
  if (!look) return NextResponse.json({ error: 'Couldn’t add the look. Try again.' }, { status: 500 });
  return NextResponse.json({ look }, { status: 201 });
}
