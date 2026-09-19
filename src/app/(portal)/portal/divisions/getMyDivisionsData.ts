import { createClient } from '@/lib/supabase/server';
import type { RoleGrant } from '@/lib/capabilities';

export interface MyDivision {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  discord_url: string | null;
}

// The divisions a 'division' role holder actually leads — someone can lead
// more than one now (see the multi-division-lead work), so this returns all
// of them, not just the first. Distinct from getDivisionsData.ts, which
// backs the full exec/admin directory manager (every division, add/rename/
// delete) — this is the lighter, content-only tool scoped to just the
// divisions this specific person is responsible for.
export async function getMyDivisionsData(roles: RoleGrant[]): Promise<MyDivision[]> {
  const divisionIds = roles.filter((r) => r.role === 'division' && r.division_id).map((r) => r.division_id as string);
  if (divisionIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('divisions')
    .select('id, name, slug, description, logo_url, discord_url')
    .in('id', divisionIds)
    .order('name');

  return data ?? [];
}
