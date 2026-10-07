import { createClient } from '@/lib/supabase/server';

// Shared by the portal hub's Site Content section.
export async function getContentData() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('site_contents')
    .select('key, content, updated_by, updated_at');

  const contentMap: Record<string, Record<string, unknown>> = {};
  rows?.forEach((row) => {
    contentMap[row.key] = row.content as Record<string, unknown>;
  });

  const updaterIds = [...new Set((rows ?? []).map((r) => r.updated_by).filter(Boolean))];
  const updaterNames: Record<string, string> = {};
  if (updaterIds.length > 0) {
    const { data: updaters } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', updaterIds as string[]);
    updaters?.forEach((u) => { updaterNames[u.id] = u.display_name || 'Unknown'; });
  }

  const lastEdited: Record<string, { by: string; at: string }> = {};
  rows?.forEach((row) => {
    if (row.updated_at) {
      lastEdited[row.key] = {
        by: row.updated_by ? (updaterNames[row.updated_by] || 'Admin') : 'Admin',
        at: row.updated_at,
      };
    }
  });

  return { contentMap, lastEdited };
}
