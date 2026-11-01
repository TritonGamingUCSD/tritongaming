import { NextResponse } from 'next/server';
import { cleanBooth } from '@/lib/photobooth/booth';
import { BOOTH_COLUMNS, authorizePhotoBooth, findEvent, loadBooth, overlaysByIds } from '@/lib/photobooth/server';

export const dynamic = 'force-dynamic';

// One event's booth (the event is given by its address word).
//   GET   the event, the booth's settings (the defaults when it has none yet) and the overlays it offers
//   PUT   save the settings (every field is brought into range) and which overlays the booth offers
export async function GET(_request: Request, { params }: { params: Promise<{ event: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const event = await findEvent(auth.svc, (await params).event);
  if (!event) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  const booth = await loadBooth(auth.svc, event.id);
  return NextResponse.json({ event, config: booth.config, overlays: booth.overlays, saved: !!booth.id });
}

export async function PUT(request: Request, { params }: { params: Promise<{ event: string }> }) {
  const auth = await authorizePhotoBooth();
  if (auth.error) return auth.error;
  const event = await findEvent(auth.svc, (await params).event);
  if (!event) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const config = cleanBooth(b);
  const overlays = await overlaysByIds(auth.svc, config.overlay_ids);
  const row = { ...config, overlay_ids: overlays.map((o) => o.id), event_id: event.id, updated_at: new Date().toISOString() };
  const { error } = await auth.svc.from('photobooths').upsert(row, { onConflict: 'event_id' }).select(BOOTH_COLUMNS).single();
  if (error) return NextResponse.json({ error: 'Couldn’t save the booth. Try again.' }, { status: 500 });
  return NextResponse.json({ config: { ...config, overlay_ids: row.overlay_ids }, overlays });
}
