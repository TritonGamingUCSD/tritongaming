import type { SupabaseClient } from '@supabase/supabase-js';

export const REQUEST_COLUMNS =
  'id, plan_id, kind, requester_id, division_id, team, contact, items, notes, status, planned_by, planned_at, created_at, updated_at, allocation_locked';

// Who is told about new and changed requests: admins, and anyone given the Logistics permission directly or through a saved group (the exec role alone does not count).
export async function logisticsTeamIds(svc: SupabaseClient): Promise<string[]> {
  const [{ data: roles }, { data: grants }] = await Promise.all([
    svc.from('user_roles').select('user_id').eq('role', 'admin'),
    svc.from('capability_grants').select('user_id, group_id').eq('capability', 'manage_logistics'),
  ]);
  const ids = new Set<string>([...(roles ?? []).map((r) => r.user_id as string), ...(grants ?? []).map((g) => g.user_id as string | null).filter((x): x is string => !!x)]);
  const groupIds = (grants ?? []).map((g) => g.group_id as string | null).filter((x): x is string => !!x);
  if (groupIds.length) {
    const { data: groups } = await svc.from('meeting_groups').select('member_ids').in('id', groupIds);
    for (const g of groups ?? []) for (const m of (g.member_ids as string[] | null) ?? []) ids.add(m);
  }
  return [...ids];
}

// Where a request is, for the links in notifications.
export const requestHref = (slug: string, kind: string) => `/portal/logistics/${slug}/requests${kind === 'prizes' ? '/prizes' : ''}`;
