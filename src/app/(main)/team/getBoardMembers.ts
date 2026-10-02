import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { createServiceClient } from '@/lib/supabase/admin';
import { fetchLinkedEmails } from '@/lib/linkedEmails';
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
  college: string | null;
  gamer_tag: string | null;
  pronouns: string | null;
  email: string | null;
  social_links: Record<string, string>;
  portfolio_links: Array<{ label: string; url: string }>;
  game_ids: Array<{ game: string; id: string }>;
  board_visibility: Record<string, boolean>;
  tier: BoardTier;
  board_order: number | null;
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
  college: string | null;
  gamer_tag: string | null;
  pronouns: string | null;
  show_on_board: boolean;
  social_links: Record<string, string> | null;
  portfolio_links: Array<{ label: string; url: string }> | null;
  game_ids: Array<{ game: string; id: string }> | null;
  board_visibility: Record<string, boolean> | null;
  board_order: number | null;
  board_email: string | null;
  user_roles: Array<{ role: AppRole }>;
}

// Public About page board — pulls live from profiles instead of the old
// admin-managed "officers" content block, so each person's own title/bio/
// picture (set on their own profile) is always current. exec/lead/officer
// all appear automatically now; only alumni still opt in (show_on_board) —
// see the profile_show_on_board migration. division and recruit never
// appear (division has its own division pages; recruit is explicitly
// pre-officer, not yet an org position worth showing publicly). 'admin'
// alone does NOT qualify — it's a platform-permissions role, not an org
// position (an admin who's also exec/lead/officer still appears, same as
// anyone else). Per-field visibility (bio, socials, year/major, pronouns,
// email) defaults to hidden regardless of tier — see isVisible() and the
// board_visibility_default_hidden migration — so someone newly auto-shown
// here isn't suddenly outed with fields they never chose to publish.
export function getBoardMembers(): Promise<BoardMember[]> {
  // Cached and shared between visitors; board-order / profile saves call
  // revalidateTag('board'). Errors throw inside so an empty board is never cached.
  return unstable_cache(fetchBoardMembers, ['board-members'], { revalidate: 300, tags: ['board'] })().catch(() => []);
}

async function fetchBoardMembers(): Promise<BoardMember[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, display_name, avatar_url, custom_avatar_url, org_title, bio, major, year, college, gamer_tag, pronouns, show_on_board, social_links, portfolio_links, game_ids, board_visibility, board_order, board_email,
      user_roles!user_roles_user_id_fkey(role)
    `);

  if (error || !data) throw error ?? new Error('no board data');

  const rows = (data as unknown as BoardProfileRow[]).filter((row) => {
    const roles = (row.user_roles ?? []).map((r) => r.role);
    return roles.includes('exec') || roles.includes('lead') || roles.includes('officer')
      || (roles.includes('alumni') && row.show_on_board);
  });

  // Emails live in auth.users, not public.profiles — only reachable via the
  // Admin API on a service-role client. Unlike the portal's (auth-gated)
  // admin/members rosters, this is a *public* page anyone can load, so a
  // bulk listUsers() call pulling all ~1000 accounts on every anonymous
  // request would be wasteful (and pointless — only opted-in board members
  // ever render an email). Fetch by ID, and only for those who've actually
  // opted in via board_visibility.email, so the request set stays tiny.
  // The email shown is the one they picked among their linked emails (board_email), checked against what is really linked
  // to the account; otherwise their sign-in email. Looked up by ID and only for those who opted in to showing email.
  const emailById = new Map<string, string | null>();
  const wantsEmail = rows.filter((row) => row.board_visibility?.email === true);
  if (wantsEmail.length > 0) {
    const serviceClient = createServiceClient();
    const picked = wantsEmail.filter((row) => row.board_email);
    const linked = picked.length ? await fetchLinkedEmails(serviceClient, picked.map((r) => r.id)) : new Map();
    await Promise.all(wantsEmail.map(async (row) => {
      try {
        if (row.board_email && (linked.get(row.id) ?? []).some((e: { email: string }) => e.email === row.board_email)) {
          emailById.set(row.id, row.board_email);
          return;
        }
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
      college: row.college,
      gamer_tag: row.gamer_tag,
      pronouns: row.pronouns,
      email: emailById.get(row.id) ?? null,
      social_links: row.social_links ?? {},
      portfolio_links: row.portfolio_links ?? [],
      game_ids: row.game_ids ?? [],
      board_visibility: row.board_visibility ?? {},
      tier,
      board_order: row.board_order,
    };
  });

  return members.sort((a, b) => {
    const rankDiff = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (rankDiff !== 0) return rankDiff;
    // Custom-ordered members (set via the admin Board Order tool) come
    // first, in that order; anyone without an order falls back to
    // alphabetical, same as before this existed.
    if (a.board_order !== null && b.board_order !== null) return a.board_order - b.board_order;
    if (a.board_order !== null) return -1;
    if (b.board_order !== null) return 1;
    return (a.display_name ?? '').localeCompare(b.display_name ?? '');
  });
}
