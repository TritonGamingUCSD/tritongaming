import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export interface RoleChangeEntry {
  id: string;
  created_at: string;
  before: { role: AppRole; division_id: string | null }[];
  after: { role: AppRole; division_id: string | null }[];
  user: { display_name: string | null } | null;
  changed_by: { display_name: string | null } | null;
}

interface RoleChangeRow {
  id: string;
  created_at: string;
  before: RoleChangeEntry['before'];
  after: RoleChangeEntry['after'];
  user: RoleChangeEntry['user'] | RoleChangeEntry['user'][];
  changed_by_profile: RoleChangeEntry['changed_by'] | RoleChangeEntry['changed_by'][];
}

// role_change_log has two foreign keys into profiles (user_id and
// changed_by) — same ambiguity PostgREST hits elsewhere in this app (see
// getAdminData.ts's user_roles query) — so both need an explicit FK hint,
// not a bare `profiles(...)`.
export async function getRoleHistoryData() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('role_change_log')
    .select(`
      id, created_at, before, after,
      user:profiles!role_change_log_user_id_fkey(display_name),
      changed_by_profile:profiles!role_change_log_changed_by_fkey(display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) console.error('[admin] failed to load role change log:', error);

  const entries: RoleChangeEntry[] = ((data ?? []) as unknown as RoleChangeRow[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    before: row.before,
    after: row.after,
    user: Array.isArray(row.user) ? row.user[0] ?? null : row.user,
    changed_by: Array.isArray(row.changed_by_profile) ? row.changed_by_profile[0] ?? null : row.changed_by_profile,
  }));

  return { entries };
}
