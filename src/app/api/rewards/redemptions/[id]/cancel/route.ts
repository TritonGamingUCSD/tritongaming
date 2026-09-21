import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

interface Params { params: Promise<{ id: string }>; }

// Undoes a redemption confirmation (or a still-pending claim) — refunds
// the points and restores stock. Same "fix a mis-scan/mis-input" intent
// as api/checkin/reverse, for the redemption side of the points system.
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('cancel_redemption', { _redemption_id: id, _cancelled_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
