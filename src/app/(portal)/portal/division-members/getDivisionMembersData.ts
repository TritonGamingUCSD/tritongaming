import { createServiceClient } from '@/lib/supabase/admin';
import { accentOf } from '@/lib/divisions/accent';
import { fetchLinkedEmails, pickDisplayEmails } from '@/lib/members/linkedEmails';

export interface DivisionMember {
  id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  gamer_tag: string | null;
  major: string | null;
  year: string | null;
  pronouns: string | null;
  minor: string | null;
  college: string | null;
  bio: string | null;
  org_title: string | null;
  social_links: Record<string, string>;
  portfolio_links: Array<{ label: string; url: string }>;
  game_ids: Array<{ game: string; id: string }>;
  created_at: string | null;
  emails: string[];
}
export interface DivisionGroup {
  id: string;
  name: string;
  logo_url: string | null;
  accent: string;
  members: DivisionMember[];
}

// Everyone holding the division role, grouped by the division they lead. (Division leads aren't part of
// the TG Members roster, so they get their own directory here.) Emails only when asked for.
export async function getDivisionMembersData(includeEmails: boolean): Promise<DivisionGroup[]> {
  // Service-role reads: the page already checked view_division_members, and recruits/division leads
  // can't read other people's role rows through their own session.
  const supabase = createServiceClient();
  const { data: divisions } = await supabase.from('divisions').select('id, name, logo_url, accent').order('name');
  const { data: grants } = await supabase.from('user_roles').select('user_id, division_id').eq('role', 'division').not('division_id', 'is', null);
  const ids = [...new Set((grants ?? []).map((g) => g.user_id as string))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, display_name, avatar_url, custom_avatar_url, gamer_tag, major, minor, college, year, pronouns, bio, org_title, social_links, portfolio_links, game_ids, created_at, preferred_email',
    )
    .in('id', ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  let emails = new Map<string, string[]>();
  if (includeEmails) {
    try {
      const linked = await fetchLinkedEmails(createServiceClient(), ids);
      emails = new Map(ids.map((id) => [id, pickDisplayEmails(linked.get(id) ?? [], byId.get(id)?.preferred_email as string | null).map((e) => e.email)]));
    } catch (err) {
      console.error('[division-members] failed to load emails:', err);
    }
  }

  return (divisions ?? [])
    .map((d) => ({
      id: d.id as string,
      name: d.name as string,
      logo_url: d.logo_url as string | null,
      accent: accentOf(d.accent as string | null).hex,
      members: (grants ?? [])
        .filter((g) => g.division_id === d.id)
        .map((g) => byId.get(g.user_id as string))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
          id: p.id as string,
          name: (p.display_name as string | null) || 'Unnamed',
          avatar_url: p.avatar_url as string | null,
          custom_avatar_url: p.custom_avatar_url as string | null,
          gamer_tag: p.gamer_tag as string | null,
          major: p.major as string | null,
          year: p.year as string | null,
          pronouns: p.pronouns as string | null,
          minor: p.minor as string | null,
          college: p.college as string | null,
          bio: p.bio as string | null,
          org_title: p.org_title as string | null,
          social_links: (p.social_links as Record<string, string> | null) ?? {},
          portfolio_links: (p.portfolio_links as Array<{ label: string; url: string }> | null) ?? [],
          game_ids: (p.game_ids as Array<{ game: string; id: string }> | null) ?? [],
          created_at: p.created_at as string | null,
          emails: emails.get(p.id as string) ?? [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((d) => d.members.length > 0);
}
