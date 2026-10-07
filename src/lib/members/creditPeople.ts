import type { SupabaseClient } from '@supabase/supabase-js';
import { isVisible } from '@/lib/members/profile';
import type { BoardVisibility } from '@/lib/members/profile';

export interface CreditPerson { id: string; name: string; link?: string }

// The officers an editor can credit for a poster or sticker, so a name and link never have to be typed twice. The link is the person's own
// public portfolio or social page, and only when they chose to show it on the team page.
export async function getCreditPeople(supabase: SupabaseClient): Promise<CreditPerson[]> {
  try {
    const { data: grants } = await supabase.from('user_roles').select('user_id').in('role', ['exec', 'lead', 'officer', 'admin', 'alumni']);
    const ids = [...new Set((grants ?? []).map((g: { user_id: string }) => g.user_id))];
    if (!ids.length) return [];
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, gamer_tag, social_links, portfolio_links, board_visibility')
      .in('id', ids);
    const people: CreditPerson[] = [];
    for (const r of (data ?? []) as { id: string; display_name: string | null; gamer_tag: string | null; social_links: Record<string, string> | null; portfolio_links: { label: string; url: string }[] | null; board_visibility: BoardVisibility | null }[]) {
      const name = r.display_name?.trim();
      if (!name) continue;
      const socials = isVisible(r.board_visibility, 'socials') ? r.social_links ?? {} : {};
      const portfolio = isVisible(r.board_visibility, 'portfolio') ? r.portfolio_links ?? [] : [];
      const link = portfolio.find((p) => /^https?:\/\//i.test(p.url))?.url
        || (/^https?:\/\//i.test(socials.instagram ?? '') ? socials.instagram : Object.values(socials).find((v) => /^https?:\/\//i.test(v)));
      people.push({ id: r.id, name, ...(link ? { link } : {}) });
    }
    return people.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
