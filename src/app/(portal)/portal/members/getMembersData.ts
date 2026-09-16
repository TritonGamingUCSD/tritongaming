import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/database';

export interface MemberProfileRow {
  id: string; display_name: string | null; avatar_url: string | null; custom_avatar_url: string | null;
  gamer_tag: string | null; major: string | null; year: string | null; org_title: string | null;
  bio: string | null; pronouns: string | null; social_links: Record<string, string> | null;
  board_visibility: Record<string, boolean> | null; email?: string | null;
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
      id, display_name, avatar_url, custom_avatar_url, gamer_tag, major, year, org_title, bio, pronouns, social_links, board_visibility,
      user_roles!user_roles_user_id_fkey(role, division:divisions(name))
    `)
    .order('display_name', { ascending: true });

  if (error) console.error('[members] failed to load members:', error);

  let members = (rows as unknown as MemberProfileRow[]) ?? [];

  // Emails live in auth.users, not public.profiles — only reachable via the
  // Admin API on a service-role client (same pattern as the admin Role
  // Manager). Best-effort: this internal roster is officer+ only, so
  // showing email here (unlike the public About page) is fine; if the
  // lookup fails, members just render without email rather than breaking
  // the whole directory.
  try {
    const { data: authData, error: authError } = await createServiceClient().auth.admin.listUsers({ perPage: 1000 });
    if (authError) throw authError;
    const emailById = new Map(authData.users.map((u) => [u.id, u.email ?? null]));
    members = members.map((m) => ({ ...m, email: emailById.get(m.id) ?? null }));
  } catch (err) {
    console.error('[members] failed to load member emails:', err);
  }

  return { rows: members };
}
