import { createClient } from '@/lib/supabase/server';
import type { Division } from '@/types/database';

export function divisionLogoSrc(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  return logoUrl.startsWith('/') || logoUrl.startsWith('http') ? logoUrl : `/${logoUrl}`;
}

// Public, read-only list of divisions, alphabetical — used by the marketing
// /divisions pages and the homepage teaser. Divisions themselves are the
// source of truth for this content now (see the divisions_content_fields
// migration), not the old site_contents block.
export async function getDivisions(): Promise<Division[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('divisions')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}
