import { createClient } from '@/lib/supabase/server';
import type { Doc, DocCategory } from '@/types/database';

// Shared by the standalone /portal/docs route and the portal hub. RLS
// already restricts reads to officer/lead/exec/admin (see the docs_table
// migration) — this is just the query, capability gating happens at the
// call site same as every other hub section.
export async function getDocsData() {
  const supabase = await createClient();
  const [{ data: docs }, { data: categories }] = await Promise.all([
    supabase
      .from('docs')
      .select('id, slug, title, category_id, parent_id, order_index, content, attachments, created_by, updated_by, created_at, updated_at')
      .order('order_index', { ascending: true })
      .order('title', { ascending: true }),
    supabase
      .from('doc_categories')
      .select('id, name, order_index, created_at')
      .order('order_index', { ascending: true })
      .order('name', { ascending: true }),
  ]);

  return {
    docs: (docs as Doc[]) ?? [],
    categories: (categories as DocCategory[]) ?? [],
  };
}
