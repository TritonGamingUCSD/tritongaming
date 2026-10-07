import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { isOrgMember } from '@/lib/members/profile';
import type { AppRole } from '@/types/database';

// Small queries for what the portal page still needs up front (card badges and the dashboard's pinned doc), so the heavy sections
// do not have to load until they are opened. Each is gated at the call site by the same capability as the section.

/** How many people hold a real org role (the same number the Members page lists). */
export async function getMemberCount(): Promise<number> {
  const { data } = await createServiceClient().from('user_roles').select('user_id, role');
  const byUser = new Map<string, { role: AppRole }[]>();
  for (const r of data ?? []) byUser.set(r.user_id as string, [...(byUser.get(r.user_id as string) ?? []), { role: r.role as AppRole }]);
  let n = 0;
  for (const roles of byUser.values()) if (isOrgMember(roles)) n++;
  return n;
}

/** The number of docs the person can see, and the first pinned published one (shown on the dashboard). */
export async function getDocsSummary(canEdit: boolean): Promise<{ count: number; pinned: { id: string; title: string } | null }> {
  const supabase = await createClient();
  let count = supabase.from('docs').select('id', { count: 'exact', head: true });
  if (!canEdit) count = count.eq('published', true);
  const [{ count: n }, { data: pinned }] = await Promise.all([
    count,
    supabase.from('docs').select('id, title').eq('pinned', true).eq('published', true).order('order_index', { ascending: true }).order('title', { ascending: true }).limit(1),
  ]);
  const p = pinned?.[0];
  return { count: n ?? 0, pinned: p ? { id: p.id as string, title: p.title as string } : null };
}

export async function getAlbumCount(): Promise<number> {
  const { count } = await (await createClient()).from('photo_albums').select('id', { count: 'exact', head: true });
  return count ?? 0;
}
