import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

// Deliberately tiny/cheap — polled every few seconds by FullscreenQR as a
// backstop for the Realtime subscription (see enable_tickets_realtime
// migration). Realtime pushes the "checked in" update instantly when it's
// working; this guarantees the screen still catches up within a few seconds
// even if a Realtime connection never established (flaky network, a
// misbehaving proxy blocking websockets, etc.).
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('user_id, status, checked_in_at')
    .eq('id', id)
    .single();

  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  return NextResponse.json({ status: ticket.status, checked_in_at: ticket.checked_in_at });
}
