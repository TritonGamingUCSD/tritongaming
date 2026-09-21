import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasCapability } from '@/lib/capabilities';

async function requireManager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_rewards_shop')) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { supabase, userId: user.id };
}

// Full catalog including inactive items — the shop view (api/rewards)
// only ever shows active ones to members.
export async function GET() {
  const ctx = await requireManager();
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('reward_items')
    .select('id, title, description, point_cost, stock, min_tier, active, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load rewards' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await requireManager();
  if (ctx.error) return ctx.error;

  const body = await request.json();
  const title = String(body.title ?? '').trim();
  const pointCost = Number(body.point_cost);
  if (!title || !Number.isFinite(pointCost) || pointCost <= 0) {
    return NextResponse.json({ error: 'A title and a positive point cost are required.' }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from('reward_items')
    .insert({
      title,
      description: body.description ? String(body.description).trim() : null,
      point_cost: Math.round(pointCost),
      stock: body.stock != null && body.stock !== '' ? Math.max(0, Math.round(Number(body.stock))) : null,
      min_tier: body.min_tier || null,
      created_by: ctx.userId,
    })
    .select('id, title, description, point_cost, stock, min_tier, active, created_at')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
