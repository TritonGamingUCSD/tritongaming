import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { logAudit } from '@/lib/notifications/audit';
import { withRole, type RoleRow } from '@/lib/portal/roleGrant';
import { isDivisionRole } from '@/types/database';

export const dynamic = 'force-dynamic';

// Who has a role in one division (Heads first, then Members, then Alumni). Names and pictures only, never emails or private details. For people in that division, and exec and admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, 'see_home')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // ?search=<name or email>: who a Head could add (names and pictures only; an address must match exactly, and is never shown).
  const search = new URL(_req.url).searchParams.get('search')?.trim();
  if (search !== undefined && search !== null && new URL(_req.url).searchParams.has('search')) {
    if (!canDivisionAction(roles, id, 'manage_members')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (search.length < 2) return NextResponse.json({ matches: [] });
    const ids = new Set<string>();
    if (search.includes('@')) {
      const { data: found } = await svc.rpc('find_users_by_emails', { _emails: [search.toLowerCase()] });
      for (const r of (found ?? []) as { user_id: string }[]) ids.add(r.user_id);
    }
    const { data: byName } = await svc
      .from('profiles')
      .select('id')
      .ilike('display_name', `%${search.replace(/[%_]/g, '')}%`)
      .limit(8);
    for (const p of byName ?? []) ids.add(p.id as string);
    const list = [...ids].slice(0, 8);
    const { data: profiles } = list.length ? await svc.from('profiles').select('id, display_name, google_first_name, custom_avatar_url, avatar_url').in('id', list) : { data: [] };
    const { data: have } = list.length ? await svc.from('user_roles').select('user_id, role').eq('division_id', id).in('user_id', list) : { data: [] };
    const haveBy = new Map((have ?? []).map((h) => [h.user_id as string, h.role as string]));
    return NextResponse.json({
      matches: (profiles ?? []).map((p) => ({
        id: p.id as string,
        name: (p.display_name as string | null) || (p.google_first_name as string | null) || 'Unnamed',
        avatarUrl: resolveAvatarUrl(p as Parameters<typeof resolveAvatarUrl>[0]),
        role: haveBy.get(p.id as string) ?? null,
      })),
    });
  }

  const { data: rows } = await svc.from('user_roles').select('user_id, role, created_at').eq('division_id', id).in('role', ['division', 'division_member', 'division_alumni']);
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length ? await svc.from('profiles').select('id, display_name, google_first_name, custom_avatar_url, avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const rank = { division: 0, division_member: 1, division_alumni: 2 } as const;
  const people = (rows ?? [])
    .map((r) => {
      const p = byId.get(r.user_id as string) as (Parameters<typeof resolveAvatarUrl>[0] & { display_name?: string | null; google_first_name?: string | null }) | undefined;
      return {
        id: r.user_id as string,
        name: p?.display_name || p?.google_first_name || 'Unnamed',
        avatarUrl: p ? resolveAvatarUrl(p) : null,
        role: r.role as keyof typeof rank,
        since: r.created_at as string,
      };
    })
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
  return NextResponse.json({ people });
}

async function actor(id: string) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, 'manage_members')) return { error: NextResponse.json({ error: 'Only the division’s Heads can change who is in it.' }, { status: 403 }) };
  return { user, svc, staff: roles.some((r) => r.role === 'exec' || r.role === 'admin') };
}

// Add someone, or change their role here: { user_id? | email?, role: 'division' | 'division_member' | 'division_alumni' }. A person has one role per division, so this replaces any they had in it.
// A Head can make another Head. The person can be found by name (the search above) or by an exact email address.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(id);
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { user_id?: string; email?: string; role?: string };
  if (!b.role || !['division', 'division_member', 'division_alumni'].includes(b.role)) return NextResponse.json({ error: 'Pick Head, Member or Alumni.' }, { status: 400 });
  let target = b.user_id ?? '';
  if (!target && b.email) {
    const { data: found } = await a.svc.rpc('find_users_by_emails', { _emails: [b.email.trim().toLowerCase()] });
    const hits = new Set(((found ?? []) as { user_id: string }[]).map((r) => r.user_id));
    if (hits.size === 0) return NextResponse.json({ error: 'No one has signed in with that address yet.' }, { status: 404 });
    if (hits.size > 1) return NextResponse.json({ error: 'That address belongs to more than one account. Ask an admin.' }, { status: 409 });
    target = [...hits][0];
  }
  if (!target) return NextResponse.json({ error: 'Say who.' }, { status: 400 });
  const { data: current } = await a.svc.from('user_roles').select('role, division_id').eq('user_id', target);
  const cur = (current ?? []) as RoleRow[];
  // The last Head cannot be turned into something else by a Head (exec and admin can).
  const heads = await a.svc.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('division_id', id).eq('role', 'division');
  if (!a.staff && b.role !== 'division' && cur.some((r) => r.role === 'division' && r.division_id === id) && (heads.count ?? 0) <= 1)
    return NextResponse.json({ error: 'A division needs at least one Head. Make someone else a Head first.' }, { status: 409 });
  const next = withRole(cur, b.role, id);
  if (!next) return NextResponse.json({ ok: true, unchanged: true });
  const { error } = await a.svc.rpc('admin_set_user_roles', { _user_id: target, _roles: next, _granted_by: a.user.id });
  if (error) return NextResponse.json({ error: 'Could not change that. Try again.' }, { status: 500 });
  await logAudit(a.svc, {
    actorId: a.user.id,
    action: 'update',
    entityType: 'role',
    entityId: target,
    summary: `Made someone a division ${b.role === 'division' ? 'Head' : b.role === 'division_member' ? 'Member' : 'Alumni'} (division roster)`,
  });
  return NextResponse.json({ ok: true });
}

// Take someone out of the division: { user_id }. Their other roles stay. The last Head cannot be removed by a Head.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(id);
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { user_id?: string };
  if (!b.user_id) return NextResponse.json({ error: 'Say who.' }, { status: 400 });
  const { data: current } = await a.svc.from('user_roles').select('role, division_id').eq('user_id', b.user_id);
  const cur = (current ?? []) as RoleRow[];
  const heads = await a.svc.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('division_id', id).eq('role', 'division');
  if (!a.staff && cur.some((r) => r.role === 'division' && r.division_id === id) && (heads.count ?? 0) <= 1)
    return NextResponse.json({ error: 'A division needs at least one Head. Make someone else a Head first.' }, { status: 409 });
  const next = cur.filter((r) => !(isDivisionRole(r.role) && r.division_id === id));
  if (next.length === cur.length) return NextResponse.json({ ok: true, unchanged: true });
  const { error } = await a.svc.rpc('admin_set_user_roles', { _user_id: b.user_id, _roles: next, _granted_by: a.user.id });
  if (error) return NextResponse.json({ error: 'Could not remove them. Try again.' }, { status: 500 });
  await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'role', entityId: b.user_id, summary: 'Removed someone from a division (division roster)' });
  return NextResponse.json({ ok: true });
}
