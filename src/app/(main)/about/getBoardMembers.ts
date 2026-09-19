import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/database';

export type BoardTier = 'exec' | 'lead' | 'officer' | 'alumni';

export interface BoardMember {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  org_title: string | null;
  bio: string | null;
  major: string | null;
  year: string | null;
  gamer_tag: string | null;
  pronouns: string | null;
  email: string | null;
  social_links: Record<string, string>;
  board_visibility: Record<string, boolean>;
  tier: BoardTier;
}

const TIER_RANK: Record<BoardTier, number> = { exec: 0, lead: 1, officer: 2, alumni: 3 };

interface BoardProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  org_title: string | null;
  bio: string | null;
  major: string | null;
  year: string | null;
  gamer_tag: string | null;
  pronouns: string | null;
  show_on_board: boolean;
  social_links: Record<string, string> | null;
  board_visibility: Record<string, boolean> | null;
  user_roles: Array<{ role: AppRole }>;
}

// Public About page board — pulls live from profiles instead of the old
// admin-managed "officers" content block, so each person's own title/bio/
// picture (set on their own profile) is always current. exec/lead appear
// automatically; officer and alumni only appear if they've opted in
// (show_on_board) — see the profile_show_on_board migration. division and
// recruit never appear (division has its own division pages; recruit is
// explicitly pre-officer, not yet an org position worth showing publicly).
// 'admin' alone does NOT qualify — it's a platform-permissions role, not an
// org position (an admin who's also exec/lead/officer still appears, same
// as anyone else).
export async function getBoardMembers(): Promise<BoardMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, custom_avatar_url, org_title, bio, major, year, gamer_tag, pronouns, show_on_board, social_links, board_visibility,
      user_roles!user_roles_user_id_fkey(role)
    `);

  if (error || !data) return [];

  const rows = (data as unknown as BoardProfileRow[]).filter((row) => {
    const roles = (row.user_roles ?? []).map((r) => r.role);
    return roles.includes('exec') || roles.includes('lead')
      || ((roles.includes('officer') || roles.includes('alumni')) && row.show_on_board);
  });

  // Emails live in auth.users, not public.profiles — only reachable via the
  // Admin API on a service-role client. Unlike the portal's (auth-gated)
  // admin/members rosters, this is a *public* page anyone can load, so a
  // bulk listUsers() call pulling all ~1000 accounts on every anonymous
  // request would be wasteful (and pointless — only opted-in board members
  // ever render an email). Fetch by ID, and only for those who've actually
  // opted in via board_visibility.email, so the request set stays tiny.
  const emailById = new Map<string, string | null>();
  const wantsEmail = rows.filter((row) => row.board_visibility?.email === true);
  if (wantsEmail.length > 0) {
    const serviceClient = createServiceClient();
    await Promise.all(wantsEmail.map(async (row) => {
      try {
        const { data, error: authError } = await serviceClient.auth.admin.getUserById(row.id);
        if (authError) throw authError;
        emailById.set(row.id, data.user?.email ?? null);
      } catch (err) {
        console.error(`[about] failed to load email for board member ${row.id}:`, err);
      }
    }));
  }

  const members: BoardMember[] = rows.map((row) => {
    const roles = (row.user_roles ?? []).map((r) => r.role);
    const tier: BoardTier = roles.includes('exec') ? 'exec' : roles.includes('lead') ? 'lead' : roles.includes('officer') ? 'officer' : 'alumni';
    return {
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      custom_avatar_url: row.custom_avatar_url,
      org_title: row.org_title,
      bio: row.bio,
      major: row.major,
      year: row.year,
      gamer_tag: row.gamer_tag,
      pronouns: row.pronouns,
      email: emailById.get(row.id) ?? null,
      social_links: row.social_links ?? {},
      board_visibility: row.board_visibility ?? {},
      tier,
    };
  });

  return members.sort((a, b) => {
    const rankDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (rankDiff !== 0) return rankDiff;
    return (a.display_name ?? '').localeCompare(b.display_name ?? '');
  });
}
