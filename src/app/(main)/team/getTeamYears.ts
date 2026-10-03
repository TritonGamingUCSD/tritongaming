import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/admin';
import { academicYearLabel } from '@/lib/quarters';

export interface PastMember { id: string; user_id: string | null; name: string; title: string | null; tier: 'exec' | 'lead' | 'officer'; avatar_url: string | null }
export interface PastYear { start_year: number; label: string; members: PastMember[] }

// The recorded teams of past academic years, for the year picker on the Team page. Cached and shared like the current board (revalidated when a year
// is recorded or edited). Someone with an account only appears if they still hold an officer-level role or have chosen to be shown on the board (the
// same rule as the current board); names an admin typed in for earlier years always appear.
export function getTeamYears(): Promise<PastYear[]> {
  return unstable_cache(fetchTeamYears, ['team-years'], { revalidate: 300, tags: ['board'] })().catch(() => []);
}

async function fetchTeamYears(): Promise<PastYear[]> {
  const svc = createServiceClient();
  const { data: years, error } = await svc.from('team_years').select('start_year').order('start_year', { ascending: false });
  if (error || !years?.length) return [];
  const { data: rows } = await svc.from('team_year_members').select('id, start_year, user_id, name, title, tier, avatar_url');
  const ids = [...new Set((rows ?? []).map((r) => r.user_id as string | null).filter((x): x is string => !!x))];
  const [{ data: profiles }, { data: roles }] = ids.length
    ? await Promise.all([svc.from('profiles').select('id, show_on_board').in('id', ids), svc.from('user_roles').select('user_id, role').in('user_id', ids).in('role', ['exec', 'lead', 'officer'])])
    : [{ data: [] as { id: string; show_on_board: boolean }[] }, { data: [] as { user_id: string; role: string }[] }];
  const shown = new Set((profiles ?? []).filter((p) => p.show_on_board).map((p) => p.id as string));
  const current = new Set((roles ?? []).map((r) => r.user_id as string));
  const rank = { exec: 0, lead: 1, officer: 2 } as const;
  return years.map((y) => ({
    start_year: y.start_year as number,
    label: academicYearLabel(y.start_year as number),
    members: (rows ?? []).filter((r) => r.start_year === y.start_year && (!r.user_id || shown.has(r.user_id as string) || current.has(r.user_id as string)))
      .map((r) => ({ id: r.id as string, user_id: r.user_id as string | null, name: r.name as string, title: r.title as string | null, tier: r.tier as PastMember['tier'], avatar_url: r.avatar_url as string | null }))
      .sort((a, b) => rank[a.tier] - rank[b.tier] || a.name.localeCompare(b.name)),
  })).filter((y) => y.members.length > 0);
}
