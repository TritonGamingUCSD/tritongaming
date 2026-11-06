import { getOffSwitches } from '@/lib/portal/featureServer';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/admin';

export interface PublicDoc {
  id: string;
  title: string;
  body: string;
}

// The division's docs marked Public, for its public page. Cached briefly like the page itself; the service client is used because the table is server-only.
export async function getPublicDivisionDocs(divisionId: string): Promise<PublicDoc[]> {
  if ((await getOffSwitches()).includes('div_public_docs')) return [];
  try {
    return await unstable_cache(
      async () => {
        const { data, error } = await createServiceClient()
          .from('division_docs')
          .select('id, title, body')
          .eq('division_id', divisionId)
          .eq('audience', 'public')
          .order('updated_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        return (data ?? []) as PublicDoc[];
      },
      ['division-public-docs', divisionId],
      { revalidate: 600, tags: ['divisions'] },
    )();
  } catch {
    return [];
  }
}
