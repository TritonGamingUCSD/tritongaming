import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { BATTLEPASS_ROLES } from '@/lib/officerTiers';

// Search scoped to officer-tier role holders only — unlike
// /api/portal/search's member lookup, awarding Battlepass points should
// only ever surface people who actually have a Battlepass to award to.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ officers: [] });

  const serviceClient = createServiceClient();
  const { data: officerRoles } = await serviceClient.from('user_roles').select('user_id').in('role', BATTLEPASS_ROLES);
  const officerIds = [...new Set((officerRoles ?? []).map((r) => r.user_id))];
  if (officerIds.length === 0) return NextResponse.json({ officers: [] });

  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, display_name')
    .in('id', officerIds)
    .ilike('display_name', `%${q}%`)
    .limit(8);

  return NextResponse.json({
    officers: (profiles ?? []).map((p) => ({ id: p.id, title: p.display_name || 'Unnamed' })),
  });
}
