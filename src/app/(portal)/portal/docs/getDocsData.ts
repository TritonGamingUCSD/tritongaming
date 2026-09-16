import { createClient } from '@/lib/supabase/server';
import type { Doc } from '@/types/database';

// Shared by the standalone /portal/docs route and the portal hub. RLS
// already restricts reads to officer/lead/exec/admin (see the docs_table
// migration) — this is just the query, capability gating happens at the
// call site same as every other hub section.
export async function getDocsData() {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from('docs')
    .select('id, slug, title, category, content, created_by, updated_by, created_at, updated_at')
    .order('category', { ascending: true, nullsFirst: true })
    .order('title', { ascending: true });

  return { docs: (docs as Doc[]) ?? [] };
}
