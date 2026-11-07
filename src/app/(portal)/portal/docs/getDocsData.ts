import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { DOC_COLUMNS, DOC_LIST_COLUMNS, DRAFT_COLUMNS, docCan, loadDocActor } from '@/lib/docs/docsServer';
import type { ClubDocLists } from '@/lib/docs/access';
import type { Doc, DocCategory, QuickLink } from '@/types/database';

// Shared by the standalone /portal/docs route and the portal hub. RLS already restricts reads to the roles that may see docs (see the docs_table
// migration); capability gating happens at the call site like every other hub section. Editors also get each doc's unpublished draft and the brand new
// docs that have not been published yet; readers only ever get what is live.
export async function getDocsData({ userId }: { userId: string; canEdit?: boolean }) {
  const supabase = await createClient();
  const svc = createServiceClient();
  // Which docs come back is decided by the database (each doc's own read list); which of them this person may edit is worked out here, so a doc's draft goes only to people who may edit it.
  const docsQuery = supabase.from('docs').select(`${DOC_COLUMNS}, ${DRAFT_COLUMNS}`).order('order_index', { ascending: true }).order('title', { ascending: true });
  const [actor, { data: lists }, { data: docs }, { data: categories }, { data: favs }, { data: groups }, { data: links }] = await Promise.all([
    loadDocActor(svc, userId),
    svc.from('docs').select(DOC_LIST_COLUMNS),
    docsQuery,
    supabase.from('doc_categories').select('id, name, order_index, color, created_at').order('order_index', { ascending: true }).order('name', { ascending: true }),
    svc.from('doc_favorites').select('doc_id').eq('user_id', userId),
    // The teams (the Team tab in TG Members): a doc can say which teams it is most useful for, and the home shows people the docs for theirs.
    svc.from('meeting_groups').select('id, name, member_ids').order('name'),
    // Quick links are their own small table, not documents.
    svc.from('quick_links').select('id, title, url, note, teams, order_index').order('order_index').order('title'),
  ]);

  const listOf = new Map((lists ?? []).map((l) => [l.id as string, l as unknown as ClubDocLists]));
  const rows = ((docs ?? []) as unknown as Partial<Doc>[])
    .map((d) => {
      const can = docCan(actor, listOf.get(d.id as string) ?? { read_access: null, edit_access: null });
      return { d, can };
    })
    .filter(({ d, can }) => d.published || can.edit)
    .map(({ d, can }) => ({
      ...d,
      ...(can.edit ? {} : { draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null }),
      can_edit: can.edit,
    })) as Doc[];
  return {
    docs: rows,
    categories: (categories as DocCategory[]) ?? [],
    links: (links ?? []) as QuickLink[],
    favorites: (favs ?? []).map((f) => f.doc_id as string),
    teams: (groups ?? []).map((g) => ({ id: g.id as string, name: g.name as string })),
    myTeamIds: (groups ?? []).filter((g) => ((g.member_ids as string[] | null) ?? []).includes(userId)).map((g) => g.id as string),
  };
}

// The quick links for the dashboard: the order the editors set, with the ones meant for this person's teams first.
export async function getDashboardLinks(userId: string): Promise<QuickLink[]> {
  const svc = createServiceClient();
  const [{ data: links }, { data: groups }] = await Promise.all([
    svc.from('quick_links').select('id, title, url, note, teams, order_index').order('order_index').order('title'),
    svc.from('meeting_groups').select('id, member_ids'),
  ]);
  const mine = new Set((groups ?? []).filter((g) => ((g.member_ids as string[] | null) ?? []).includes(userId)).map((g) => g.id as string));
  const rows = (links ?? []) as QuickLink[];
  return [...rows].sort((a, b) => Number(b.teams.some((t) => mine.has(t))) - Number(a.teams.some((t) => mine.has(t))) || a.order_index - b.order_index);
}
