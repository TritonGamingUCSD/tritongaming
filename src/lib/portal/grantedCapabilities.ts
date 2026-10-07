import type { SupabaseClient } from '@supabase/supabase-js';
import type { Capability } from '@/types/database';
import { GRANTABLE_CAPABILITIES } from '@/lib/portal/capabilities';

// The extra permissions a person has: granted to them directly, or to a saved group they're in.
export async function loadGrantedCapabilities(svc: SupabaseClient, userId: string): Promise<Capability[]> {
  const { data: groups } = await svc.from('meeting_groups').select('id').contains('member_ids', [userId]);
  const groupIds = (groups ?? []).map((g) => g.id as string);
  let q = svc.from('capability_grants').select('capability, user_id, group_id');
  q = groupIds.length ? q.or(`user_id.eq.${userId},group_id.in.(${groupIds.join(',')})`) : q.eq('user_id', userId);
  const { data } = await q;
  const allowed = new Set(GRANTABLE_CAPABILITIES.map((c) => c.id as string));
  return [...new Set((data ?? []).map((g) => g.capability as string))].filter((c) => allowed.has(c)) as Capability[];
}
