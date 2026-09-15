import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export interface MemberProfileRow {
  id: string; display_name: string | null; avatar_url: string | null; custom_avatar_url: string | null;
  gamer_tag: string | null; major: string | null; year: string | null;
  user_roles: Array<{
    role: AppRole;
    division: { name: string } | { name: string }[] | null;
  }>;
}

// Shared by the standalone /portal/members route and the portal hub.
export async function getMembersData() {
  const supabase = await createClient();

  // Start from profiles, not user_roles — otherwise anyone with zero role
  // grants (e.g. everyone who signed up before the multi-role migration, or
  // any plain guest) is invisible rather than just unlabeled.
  //
  // user_roles has TWO foreign keys into profiles (user_id and granted_by),
  // so embedding it here without a hint is ambiguous to PostgREST — it
  // errors, and unchecked that silently becomes an empty page.
  const { data: rows, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, custom_avatar_url, gamer_tag, major, year,
      user_roles!user_roles_user_id_fkey(role, division:divisions(name))
    `)
    .order('created_at', { ascending: true });

  if (error) console.error('[members] failed to load members:', error);

  return { rows: (rows as unknown as MemberProfileRow[]) ?? [] };
}
