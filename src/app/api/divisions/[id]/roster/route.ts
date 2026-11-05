import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { resolveAvatarUrl } from '@/lib/members/profile';

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
