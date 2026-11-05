import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { isVisible, type BoardVisibility } from '@/lib/members/profile';

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
