import { NextResponse } from 'next/server';
import { AUDIENCE_ROLES } from '@/lib/meetingAudience';
import { authorizeMeetings } from '@/lib/meetings';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';

export const dynamic = 'force-dynamic';

// Everyone on the team an exec can put in a group or invite to a meeting, with their roles so the
// picker can offer "add all leads" style shortcuts.
export async function GET() {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { data: grants } = await auth.svc.from('user_roles').select('user_id, role').in('role', [...AUDIENCE_ROLES]);
  const rolesOf = new Map<string, AppRole[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), g.role as AppRole]);
  const ids = [...rolesOf.keys()];
  const { data: profiles } = ids.length ? await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', ids) : { data: [] };
  const people = (profiles ?? []).map((p) => {
    const roles = rolesOf.get(p.id as string) ?? [];
    const top = [...roles].sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return { id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null, roles, role: top ? ROLE_LABELS[top] : '' };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ people });
}
