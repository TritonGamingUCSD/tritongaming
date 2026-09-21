import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';
import { rotatingCode, currentEventCodeWindow, secondsUntilNextEventCodeWindow } from '@/lib/rotatingCode';

interface Params { params: Promise<{ eventId: string }>; }

// Officer-facing — reveals the current code to relay in Discord/Zoom chat
// for an online event. See performCheckin's sibling api/checkin/online for
// the member-facing half and rotatingCode.ts for why this is keyed by the
// event's server-only checkin_secret, not its (public) id.
export async function GET(request: Request, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'checkin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title, checkin_secret')
    .eq('id', eventId)
    .single();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const code = rotatingCode(event.checkin_secret, currentEventCodeWindow());
  return NextResponse.json({ code, secondsRemaining: secondsUntilNextEventCodeWindow(), eventTitle: event.title });
}
