import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Catch-all manual correction — for anything the check-in/redemption
// reversal routes don't cover. Free-form amount (positive or negative)
// with a required note, so the ledger stays legible to whoever reads it
// later.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { user_id, amount, note } = await request.json();
  const parsedAmount = Math.round(Number(amount));
  if (!user_id || !parsedAmount || !note || !String(note).trim()) {
    return NextResponse.json({ error: 'A member, a non-zero amount, and a note are all required.' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('admin_adjust_points', {
    _user_id: user_id,
    _amount: parsedAmount,
    _note: String(note).trim(),
    _admin_id: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
