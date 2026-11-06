import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';

export interface DivisionHeads {
  divisionId: string;
  heads: { id: string; name: string }[];
}

interface Row {
  division_id: string;
  profile: { id: string; display_name: string | null; show_on_board: boolean } | { id: string; display_name: string | null; show_on_board: boolean }[] | null;
}

// Every division's Heads who chose to show on the board, for the Team page. Cached and shared; errors throw inside the cache so they are never stored.
export async function getDivisionHeads(): Promise<DivisionHeads[]> {
  try {
    return await unstable_cache(
      async () => {
        const { data, error } = await createPublicClient()
          .from('user_roles')
          .select('division_id, profile:profiles(id, display_name, show_on_board)')
          .eq('role', 'division')
          .not('division_id', 'is', null);
        if (error) throw error;
        const by = new Map<string, DivisionHeads>();
        for (const r of (data ?? []) as unknown as Row[]) {
          const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
          const entry = by.get(r.division_id) ?? { divisionId: r.division_id, heads: [] };
          if (p?.show_on_board && p.display_name) entry.heads.push({ id: p.id, name: p.display_name });
          by.set(r.division_id, entry);
        }
        return [...by.values()];
      },
      ['division-heads'],
      { revalidate: 3600, tags: ['divisions', 'board'] },
    )();
  } catch {
    return [];
  }
}
