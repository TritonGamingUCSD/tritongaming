import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { parseStorageUrl } from '@/lib/imageUpload';
import { getEventById } from '@/lib/events';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error(`GET /api/events/${id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
  }
}

// Permanent, admin-only event deletion. Deliberately hard to trigger by
// accident: besides the capability check, the caller must echo back the
// event's exact title (the UI sends it after two other confirm steps and a
// press-and-hold), so a stray request or stale client can't delete anything.
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'delete_events')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const confirmTitle = typeof body.confirmTitle === 'string' ? body.confirmTitle : '';
  const reversePoints = body.reversePoints !== false;

  const service = createServiceClient();
  const { data: event } = await service.from('events').select('id, title').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (confirmTitle.trim() !== event.title.trim()) {
    return NextResponse.json({ error: 'Confirmation title does not match.' }, { status: 400 });
  }

  const { data: result, error } = await service.rpc('admin_delete_event', {
    p_event_id: id,
    p_reverse_points: reversePoints,
  });
  if (error) {
    console.error('[delete event] rpc error:', error);
    return NextResponse.json({ error: 'Failed to delete event.' }, { status: 500 });
  }

  // Best-effort: the DB delete is what matters, a leftover flyer file isn't fatal.
  const flyer = (result as { flyer_url?: string | null } | null)?.flyer_url;
  const parsed = flyer ? parseStorageUrl(flyer) : null;
  if (parsed) {
    await service.storage.from(parsed.bucket).remove([parsed.path]).catch(() => {});
  }

  return NextResponse.json({ ok: true, ...(result as object) });
}
