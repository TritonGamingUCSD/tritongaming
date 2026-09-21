import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';

interface Params { params: Promise<{ id: string }>; }

async function requireManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_rewards_shop')) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { supabase };
}

// Edits, or retires (active: false) rather than deletes — a retired item
// with past redemptions needs to stay around for those records to still
// make sense; there's no delete endpoint at all for that reason.
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const ctx = await requireManager();
  if (ctx.error) return ctx.error;

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = String(body.title).trim();
  if (body.description !== undefined) update.description = body.description ? String(body.description).trim() : null;
  if (body.point_cost !== undefined) update.point_cost = Math.max(1, Math.round(Number(body.point_cost)));
  if (body.stock !== undefined) update.stock = body.stock === null || body.stock === '' ? null : Math.max(0, Math.round(Number(body.stock)));
  if (body.min_tier !== undefined) update.min_tier = body.min_tier || null;
  if (body.active !== undefined) update.active = Boolean(body.active);

  const { data, error } = await ctx.supabase
    .from('reward_items')
    .update(update)
    .eq('id', id)
    .select('id, title, description, point_cost, stock, min_tier, active, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update reward' }, { status: 500 });
  return NextResponse.json({ item: data });
}
