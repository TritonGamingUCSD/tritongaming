import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Backs the admin "reverse a specific transaction" tool — lets an officer
// browse a member's own ledger instead of guessing a free-form amount to
// enter. See reverse_point_transaction in
// 20260921093000_fix_reversal_math_and_generic_reverse.sql.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('point_transactions')
    .select('id, amount, type, note, created_at, reversed_at, reverses_transaction_id, event:events(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data ?? [] });
}
