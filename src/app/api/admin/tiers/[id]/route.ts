import { logAudit } from '@/lib/notifications/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import type { Capability } from '@/types/database';
import { strictUser } from '@/lib/supabase/localAuth';
import { invalidate } from '@/lib/site/revalidate';

const SYSTEM_CAPABILITY: Record<string, Capability> = {
  member: 'manage_rewards_shop',
  officer: 'manage_points',
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
  return { userId: user.id };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  // See admin/tiers/route.ts's POST handler for why no .single() here.
  const { data, error } = await serviceClient.rpc('admin_upsert_tier', {
    _system: system, _id: id, _name: name, _min_points: minPoints, _color: color,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: ctx.userId ?? null, action: 'update', entityType: 'tier', entityId: id, summary: `Tier "${name}" edited (${minPoints} pts, ${system})` });
  invalidate('tiers');
  return NextResponse.json({ tier: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const system = new URL(request.url).searchParams.get('system') ?? '';
  const ctx = await requireManager(system);
  if (ctx.error) return ctx.error;

  const serviceClient = createServiceClient();
  const { error } = await serviceClient.rpc('admin_delete_tier', { _system: system, _id: id });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(serviceClient, { actorId: ctx.userId ?? null, action: 'delete', entityType: 'tier', entityId: id, summary: `A ${system} tier was deleted` });
  invalidate('tiers');
  return NextResponse.json({ ok: true });
}
