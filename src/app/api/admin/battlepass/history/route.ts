import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Mirrors /api/admin/points/history against the officer_* ledger — browse
// one officer's Battlepass history to reverse a specific entry.
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
    .from('officer_point_transactions')
    .select('id, amount, type, note, created_at, reversed_at, reverses_transaction_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transactions: data ?? [] });
}
