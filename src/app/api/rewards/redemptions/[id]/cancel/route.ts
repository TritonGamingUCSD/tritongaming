import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { createNotifications } from '@/lib/notifications/notify';
import { logAudit } from '@/lib/notifications/audit';

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
  const { data: r } = await serviceClient.from('reward_redemptions').select('user_id, status, point_cost, reward:reward_items(title), member:profiles!reward_redemptions_user_id_fkey(display_name)').eq('id', id).maybeSingle();
  const { error } = await serviceClient.rpc('cancel_redemption', { _redemption_id: id, _cancelled_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const one = (x: unknown): Record<string, string> | null => ((Array.isArray(x) ? x[0] : x) ?? null) as Record<string, string> | null;
  await logAudit(serviceClient, { actorId: user.id, action: 'cancel', entityType: 'reward redemption', entityId: (r?.user_id as string | undefined) ?? id, summary: `Cancelled ${one(r?.member)?.display_name ?? 'a member'}’s claim of "${one(r?.reward)?.title ?? 'a reward'}" and refunded ${r?.point_cost ?? 0} points`, details: { redemption: id, was: r?.status ?? null, points: r?.point_cost ?? null } });
  if (r?.user_id && r.user_id !== user.id) await createNotifications(serviceClient, [{ user_id: r.user_id as string, type: 'reward_cancelled', title: 'A reward claim was cancelled', body: `${one(r?.reward)?.title ?? 'Your reward'}: ${r?.point_cost ?? 0} points were refunded.`, href: '/portal/points' }]);
  return NextResponse.json({ ok: true });
}
