import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export type BoardTier = 'exec' | 'lead' | 'officer';

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
  social_links: Record<string, string>;
  board_visibility: Record<string, boolean>;
  tier: BoardTier;
}

const TIER_RANK: Record<BoardTier, number> = { exec: 0, lead: 1, officer: 2 };

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
  show_on_board: boolean;
  social_links: Record<string, string> | null;
  board_visibility: Record<string, boolean> | null;
  user_roles: Array<{ role: AppRole }>;
}

// Public About page board — pulls live from profiles instead of the old
// admin-managed "officers" content block, so each person's own title/bio/
// picture (set on their own profile) is always current. exec/lead appear
// automatically; officer only appears if they've opted in (show_on_board);
// division never appears (they have their own division pages) — see the
// profile_show_on_board migration. 'admin' alone does NOT qualify — it's a
// platform-permissions role, not an org position (an admin who's also exec/
// lead/officer still appears, same as anyone else).
export async function getBoardMembers(): Promise<BoardMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, custom_avatar_url, org_title, bio, major, year, gamer_tag, show_on_board, social_links, board_visibility,
      user_roles!user_roles_user_id_fkey(role)
    `);

  if (error || !data) return [];

  const members: BoardMember[] = [];
  for (const row of data as unknown as BoardProfileRow[]) {
    const roles = (row.user_roles ?? []).map((r) => r.role);
    let tier: BoardTier | null = null;
    if (roles.includes('exec')) tier = 'exec';
    else if (roles.includes('lead')) tier = 'lead';
    else if (roles.includes('officer') && row.show_on_board) tier = 'officer';

    if (!tier) continue;
    members.push({
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      custom_avatar_url: row.custom_avatar_url,
      org_title: row.org_title,
      bio: row.bio,
      major: row.major,
      year: row.year,
      gamer_tag: row.gamer_tag,
      social_links: row.social_links ?? {},
      board_visibility: row.board_visibility ?? {},
      tier,
    });
  }

  return members.sort((a, b) => {
    const rankDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (rankDiff !== 0) return rankDiff;
    return (a.display_name ?? '').localeCompare(b.display_name ?? '');
  });
}
