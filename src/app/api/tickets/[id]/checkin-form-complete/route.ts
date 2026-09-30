import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

// Records that the ticket holder told us they finished the AS Form — not
// proof of an actual Google Forms submission (the app has no way to detect
// that, see checkin_form_completed_at migration). Only the ticket's own
// owner can mark it, via the regular RLS-respecting client for the
// ownership check; the actual write goes through the service client since
// tickets has no general self-update policy for a ticket holder (see
// 20260915033819_multi_role_capabilities.sql — update is checkin-capability
// only), and this route is the sole gate on which single column that write
// is allowed to touch.
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('user_id')
    .eq('id', id)
    .single();

  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from('tickets')
    .update({ checkin_form_completed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[checkin-form-complete] update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
