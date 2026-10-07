import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/admin';
import { academicYearLabel } from '@/lib/members/quarters';

export interface PastMember { id: string; user_id: string | null; name: string; title: string | null; tier: 'exec' | 'lead' | 'officer'; avatar_url: string | null }
export interface PastYear { start_year: number; label: string; members: PastMember[] }

// The recorded teams of past academic years, for the year picker on the Team page. Cached and shared like the current board (revalidated when a year
// is recorded or edited). Everyone recorded for a year appears (name, title and picture only): they were on the public board
// that year, so becoming an alumnus later doesn't remove them. An admin can remove a person from a year in Quarter status → Years.
export function getTeamYears(): Promise<PastYear[]> {
  return unstable_cache(fetchTeamYears, ['team-years'], { revalidate: 300, tags: ['board'] })().catch(() => []);
}

async function fetchTeamYears(): Promise<PastYear[]> {
  const svc = createServiceClient();
  const { data: years, error } = await svc.from('team_years').select('start_year').order('start_year', { ascending: false });
  if (error || !years?.length) return [];
  const { data: rows } = await svc.from('team_year_members').select('id, start_year, user_id, name, title, tier, avatar_url');
  const rank = { exec: 0, lead: 1, officer: 2 } as const;
  return years.map((y) => ({
    start_year: y.start_year as number,
    label: academicYearLabel(y.start_year as number),
    members: (rows ?? []).filter((r) => r.start_year === y.start_year)
      .map((r) => ({ id: r.id as string, user_id: r.user_id as string | null, name: r.name as string, title: r.title as string | null, tier: r.tier as PastMember['tier'], avatar_url: r.avatar_url as string | null }))
      .sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name)),
  })).filter((y) => y.members.length > 0);
}
