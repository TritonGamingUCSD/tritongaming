import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { fetchLinkedEmails, pickDisplayEmails, type LinkedEmail } from '@/lib/linkedEmails';
import { isOrgMember } from '@/lib/profile';
import type { AppRole } from '@/types/database';

export interface MemberProfileRow {
  id: string; display_name: string | null; avatar_url: string | null; custom_avatar_url: string | null;
  gamer_tag: string | null; major: string | null; year: string | null; college: string | null; org_title: string | null;
  portfolio_links: Array<{ label: string; url: string }> | null; created_at: string | null;
  bio: string | null; pronouns: string | null; social_links: Record<string, string> | null;
  board_visibility: Record<string, boolean> | null; preferred_email?: string | null; emails?: LinkedEmail[];
  board_order: number | null;
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
      id, display_name, avatar_url, custom_avatar_url, gamer_tag, major, year, college, org_title, bio, pronouns, social_links, portfolio_links, created_at, board_visibility, preferred_email, board_order,
      user_roles!user_roles_user_id_fkey(role, division:divisions(name))
    `)
    // Custom-ordered members (Board Order admin tool, exec/lead mainly)
    // sort first in that order; everyone else falls back to alphabetical,
    // same as before board_order existed.
    .order('board_order', { ascending: true, nullsFirst: false })
    .order('display_name', { ascending: true });

  if (error) console.error('[members] failed to load members:', error);

  let members = (rows as unknown as MemberProfileRow[]) ?? [];

  // Emails live in auth.users/auth.identities, not public.profiles — only
  // reachable via a service-role client (same pattern as the admin Role
  // Manager). A member can have more than one linked sign-in email (their
  // Google address plus a linked second one — see LinkGoogleSection.tsx),
  // so this pulls every linked email, not just auth.users.email's current
  // "primary" one. Best-effort: this internal roster is officer+ only, so
  // showing email here (unlike the public About page) is fine; if the
  // lookup fails, members just render without email rather than breaking
  // the whole directory. Everything a member has filled in is shown here —
  // the Officer Card visibility toggles only govern the public Team page.
  // (Gender and the Gaming & Interests answers live in profile_private and are
  // deliberately not part of this roster.)
  try {
    const emailsByUserId = await fetchLinkedEmails(createServiceClient(), members.map((m) => m.id));
    members = members.map((m) => ({ ...m, emails: pickDisplayEmails(emailsByUserId.get(m.id) ?? [], m.preferred_email) }));
  } catch (err) {
    console.error('[members] failed to load member emails:', err);
  }

  return { rows: members, memberCount: members.filter((m) => isOrgMember(m.user_roles)).length };
}
