import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { DOC_COLUMNS, DRAFT_COLUMNS } from '@/lib/docsServer';
import type { Doc, DocCategory } from '@/types/database';

// Shared by the standalone /portal/docs route and the portal hub. RLS already restricts reads to the roles that may see docs (see the docs_table
// migration); capability gating happens at the call site like every other hub section. Editors also get each doc's unpublished draft and the brand new
// docs that have not been published yet; readers only ever get what is live.
export async function getDocsData({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const supabase = await createClient();
  let docsQuery = supabase
    .from('docs')
    .select(canEdit ? `${DOC_COLUMNS}, ${DRAFT_COLUMNS}` : DOC_COLUMNS)
    .order('order_index', { ascending: true })
    .order('title', { ascending: true });
  if (!canEdit) docsQuery = docsQuery.eq('published', true);
  const [{ data: docs }, { data: categories }, { data: favs }] = await Promise.all([
    docsQuery,
    supabase
      .from('doc_categories')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true })
      .order('name', { ascending: true }),
    createServiceClient().from('doc_favorites').select('doc_id').eq('user_id', userId),
  ]);

  const rows = ((docs ?? []) as unknown as Partial<Doc>[]).map((d) => ({ draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null, ...d })) as Doc[];
  return {
    docs: rows,
    categories: (categories as DocCategory[]) ?? [],
    favorites: (favs ?? []).map((f) => f.doc_id as string),
  };
}
