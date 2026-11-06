import type { SupabaseClient } from '@supabase/supabase-js';
import type { Capability } from '@/types/database';
import { GRANTABLE_CAPABILITIES } from '@/lib/portal/capabilities';

// The access rules that apply to a person right now, from rules made for them or for a saved group they are in: permissions handed to them, and permissions taken away (as `deny:<permission>`).
// A rule past its end date no longer counts. A denial wins over a grant. Wherever roles are loaded these are added with withGrantedCapabilities().
export async function loadGrantedCapabilities(svc: SupabaseClient, userId: string): Promise<(Capability | `deny:${Capability}`)[]> {
  const { data: groups } = await svc.from('meeting_groups').select('id').contains('member_ids', [userId]);
  const groupIds = (groups ?? []).map((g) => g.id as string);
  let q = svc.from('capability_grants').select('capability, effect, expires_at');
  q = groupIds.length ? q.or(`user_id.eq.${userId},group_id.in.(${groupIds.join(',')})`) : q.eq('user_id', userId);
  const { data } = await q;
  const now = Date.now();
  const live = (data ?? []).filter((g) => !g.expires_at || new Date(g.expires_at as string).getTime() > now);
  const allowed = new Set(GRANTABLE_CAPABILITIES.map((c) => c.id as string));
  const denies = [...new Set(live.filter((g) => g.effect === 'deny').map((g) => g.capability as string))] as Capability[];
  const grants = [...new Set(live.filter((g) => g.effect !== 'deny').map((g) => g.capability as string))].filter((c) => allowed.has(c)) as Capability[];
  return [...grants, ...denies.map((c) => `deny:${c}` as const)];
}
