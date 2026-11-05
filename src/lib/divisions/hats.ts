import type { SupabaseClient } from '@supabase/supabase-js';
import type { RoleGrant } from '@/lib/portal/capabilities';
import { divisionLevel } from '@/lib/portal/divisionAccess';
import { accentOf } from './accent';
import type { DivisionHat } from '@/components/portal/hubTypes';

// The divisions a person can act in, for the portal's switcher ("hats"): the ones they hold a division role in, or every division for exec and admin (full access). Each carries its logo, accent color
// and how many Heads, Members and Alumni it has (for the division's home). Exec and admin who also hold a role in a division show that level; the rest show as 'staff'.
export async function loadDivisionHats(svc: SupabaseClient, roles: RoleGrant[]): Promise<DivisionHat[]> {
  const staff = roles.some((r) => r.role === 'exec' || r.role === 'admin');
  const { data: divisions } = await svc.from('divisions').select('id, slug, name, logo_url, accent').order('name');
  const mine = (divisions ?? []).filter((d) => staff || divisionLevel(roles, d.id as string));
  if (!mine.length) return [];
  const { data: rows } = await svc
    .from('user_roles')
    .select('division_id, role')
    .in(
      'division_id',
      mine.map((d) => d.id as string),
    );
  const counts = new Map<string, { heads: number; members: number; alumni: number }>();
  for (const r of rows ?? []) {
    const c = counts.get(r.division_id as string) ?? { heads: 0, members: 0, alumni: 0 };
    if (r.role === 'division') c.heads++;
    else if (r.role === 'division_member') c.members++;
    else if (r.role === 'division_alumni') c.alumni++;
    counts.set(r.division_id as string, c);
  }
  return mine.map((d) => ({
    id: d.id as string,
    slug: d.slug as string,
    name: d.name as string,
    logoUrl: (d.logo_url as string | null) ?? null,
    accent: accentOf(d.accent as string | null).hex,
    level: staff ? 'staff' : (divisionLevel(roles, d.id as string) ?? 'alumni'),
    counts: counts.get(d.id as string) ?? { heads: 0, members: 0, alumni: 0 },
  }));
}
