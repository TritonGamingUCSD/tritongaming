import { NextResponse } from 'next/server';
import { AUDIENCE_ROLES } from '@/lib/meetingAudience';
import { authorizeMeetings } from '@/lib/meetings';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';
import { staffName } from '@/lib/names';

export const dynamic = 'force-dynamic';

// Everyone on the team an exec can put in a group or invite to a meeting, with their roles so the
// picker can offer "add all leads" style shortcuts.
export async function GET() {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { data: grants } = await auth.svc.from('user_roles').select('user_id, role').in('role', [...AUDIENCE_ROLES, 'inactive', 'alumni']);
  const rolesOf = new Map<string, AppRole[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), g.role as AppRole]);
  const idle = new Set([...rolesOf.entries()].filter(([, r]) => r.includes('inactive' as AppRole) || r.includes('alumni' as AppRole)).map(([id]) => id));
  const alumni = new Set([...rolesOf.entries()].filter(([, r]) => r.includes('alumni' as AppRole)).map(([id]) => id));
  // 'inactive' is only a marker next to a team role; people holding nothing else are not offered.
  const ids = [...rolesOf.entries()].filter(([, r]) => r.some((x) => (AUDIENCE_ROLES as readonly string[]).includes(x))).map(([id]) => id);
  const { data: profiles } = ids.length ? await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', ids) : { data: [] };
  const people = (profiles ?? []).map((p) => {
    const roles = (rolesOf.get(p.id as string) ?? []).filter((r) => r !== ('inactive' as AppRole) && r !== ('alumni' as AppRole));
    const top = [...roles].sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return { id: p.id as string, name: staffName(p), avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null, roles, role: top ? ROLE_LABELS[top] : '', inactive: idle.has(p.id as string), alumni: alumni.has(p.id as string) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ people });
}
