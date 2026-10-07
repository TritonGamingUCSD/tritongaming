import { logAudit } from '@/lib/notifications/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import type { Capability } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';
import { invalidate } from '@/lib/site/revalidate';

// The member tier ladder is a manage_rewards_shop concern.
const SYSTEM_CAPABILITY: Record<string, Capability> = {
  member: 'manage_rewards_shop',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

async function requireManager(system: string) {
  const capability = SYSTEM_CAPABILITY[system];
  if (!capability) return { error: NextResponse.json({ error: 'Invalid tier system.' }, { status: 400 }) };

  const supabase = await createClient();
  const { data: { user } } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], capability)) {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { supabase, userId: user.id };
}

export async function GET(request: Request) {
  const system = new URL(request.url).searchParams.get('system') ?? '';
  const ctx = await requireManager(system);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from('tier_definitions')
    .select('id, name, min_points, color')
    .eq('system', system)
    .order('min_points');

  if (error) return NextResponse.json({ error: 'Failed to load tiers.' }, { status: 500 });
  return NextResponse.json({ tiers: data ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const system = String(body.system ?? '');
  const ctx = await requireManager(system);
  if (ctx.error) return ctx.error;

  const name = String(body.name ?? '').trim();
  const minPoints = Math.round(Number(body.min_points));
  const color = String(body.color ?? '');
  if (!name || !Number.isFinite(minPoints) || minPoints < 0) {
    return NextResponse.json({ error: 'A name and a non-negative point threshold are required.' }, { status: 400 });
  }
  if (!HEX_COLOR.test(color)) {
    return NextResponse.json({ error: 'Color must be a hex value like #a1b2c3.' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  // No .single() — admin_upsert_tier returns public.tier_definitions (not
  // SETOF), so PostgREST already hands this back as one object, not an
  // array; every other RPC call in this codebase relies on that same
  // behavior rather than chaining .single() on top of it.
  const { data, error } = await serviceClient.rpc('admin_upsert_tier', {
    _system: system, _id: null, _name: name, _min_points: minPoints, _color: color,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: ctx.userId ?? null, action: 'create', entityType: 'tier', entityId: String((data as { id?: string } | null)?.id ?? ''), summary: `Tier "${name}" created (${minPoints} pts, ${system})` });
  invalidate('tiers');
  return NextResponse.json({ tier: data }, { status: 201 });
}
