import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { isVisible, type BoardVisibility } from '@/lib/members/profile';
import type { BoardMember, BoardTier } from '@/app/(main)/team/getBoardMembers';

export interface DivisionLead {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  org_title: string | null;
  gamer_tag: string | null;
  pronouns: string | null;
  board_visibility: BoardVisibility | null;
}

interface LeadRow {
  user_id: string;
  role: string;
  profile:
    | {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        custom_avatar_url: string | null;
        org_title: string | null;
        gamer_tag: string | null;
        pronouns: string | null;
        show_on_board: boolean;
        board_visibility: BoardVisibility | null;
      }
    | {
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        custom_avatar_url: string | null;
        org_title: string | null;
        gamer_tag: string | null;
        pronouns: string | null;
        show_on_board: boolean;
        board_visibility: BoardVisibility | null;
      }[]
    | null;
}

// Turns the static division marketing page into a real hub: its own
// upcoming events (tagged via events.division_id — see the
// add_division_id_to_events migration) and who currently leads it. Leads
// are gated by the same show_on_board opt-in as the About page's board
// (getBoardMembers.ts) — division-role holders are deliberately excluded
// from that page ("they have their own division pages") — this is that page.
export function getDivisionHubData(divisionId: string) {
  // Cached briefly and shared between visitors; failures throw so they aren't cached.
  return unstable_cache(() => fetchDivisionHubData(divisionId), ['division-hub', divisionId], { revalidate: 3600, tags: ['divisions', 'board'] })().catch(() => ({
    leads: [] as DivisionLead[],
    members: [] as DivisionLead[],
    alumni: [] as DivisionLead[],
  }));
}

async function fetchDivisionHubData(divisionId: string) {
  const supabase = createPublicClient();

  const [{ data: leadRows, error: leadsErr }] = await Promise.all([
    supabase
      .from('user_roles')
      .select('user_id, role, profile:profiles(id, display_name, avatar_url, custom_avatar_url, org_title, gamer_tag, pronouns, show_on_board, board_visibility)')
      .in('role', ['division', 'division_member', 'division_alumni'])
      .eq('division_id', divisionId),
  ]);

  if (leadsErr) throw leadsErr;

  const rows = (leadRows ?? []) as unknown as LeadRow[];
  const pick = (role: string): DivisionLead[] =>
    rows
      .filter((r) => r.role === role)
      .map((r) => (Array.isArray(r.profile) ? r.profile[0] : r.profile))
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.show_on_board)
      .map((p) => ({
        id: p.id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        custom_avatar_url: p.custom_avatar_url,
        org_title: p.org_title,
        gamer_tag: p.gamer_tag,
        pronouns: p.pronouns,
        board_visibility: p.board_visibility,
      }));

  return {
    leads: pick('division'),
    members: pick('division_member'),
    alumni: pick('division_alumni'),
  };
}

// Re-exported so callers don't need to reach into '@/lib/members/profile' just to
// render a lead's pronouns.
export { isVisible };

const COLS =
  'id, display_name, avatar_url, custom_avatar_url, org_title, bio, major, minor, year, college, gamer_tag, pronouns, show_on_board, social_links, portfolio_links, game_ids, board_visibility, board_order';

interface FullProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  org_title: string | null;
  bio: string | null;
  major: string | null;
  minor: string | null;
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
}

// A division's people as the same cards officers get (photo card, details popup), for the people who chose to show on the board. Heads sit in the second row of cards, Members in the third, Alumni on the wall.
// (Emails are never part of a division card.) Cached and shared; errors throw inside the cache so they are never stored.
export function getDivisionCards(divisionId: string): Promise<BoardMember[]> {
  return unstable_cache(() => fetchDivisionCards(divisionId), ['division-cards', divisionId], { revalidate: 3600, tags: ['divisions', 'board'] })().catch(
    () => [] as BoardMember[],
  );
}

async function fetchDivisionCards(divisionId: string): Promise<BoardMember[]> {
  const { data, error } = await createPublicClient()
    .from('user_roles')
    .select(`role, profile:profiles(${COLS})`)
    .in('role', ['division', 'division_member', 'division_alumni'])
    .eq('division_id', divisionId);
  if (error) throw error;
  const tierOf: Record<string, BoardTier> = { division: 'lead', division_member: 'officer', division_alumni: 'alumni' };
  const out: BoardMember[] = [];
  for (const r of (data ?? []) as unknown as { role: string; profile: FullProfile | FullProfile[] | null }[]) {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    if (!p || !p.show_on_board) continue;
    out.push({
      id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      custom_avatar_url: p.custom_avatar_url,
      org_title: p.org_title,
      bio: p.bio,
      major: p.major,
      minor: p.minor,
      year: p.year,
      college: p.college,
      gamer_tag: p.gamer_tag,
      pronouns: p.pronouns,
      email: null,
      social_links: p.social_links ?? {},
      portfolio_links: p.portfolio_links ?? [],
      game_ids: p.game_ids ?? [],
      board_visibility: p.board_visibility ?? {},
      tier: tierOf[r.role],
      board_order: p.board_order,
    });
  }
  return out.sort((a, b) => (a.board_order ?? 999) - (b.board_order ?? 999) || (a.display_name ?? '').localeCompare(b.display_name ?? ''));
}
