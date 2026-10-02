import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Per-request holder for the editor's unsaved Site Content edits. /preview fills it (ensurePreviewDrafts) before rendering anything,
// and getContentBlocks (lib/content.ts) lays it over the saved content. Outside /preview it is always empty, so the public site
// never sees a draft.
const holder = cache(() => ({ drafts: null as Record<string, Record<string, unknown>> | null }));

export function getPreviewDrafts() {
  return holder().drafts;
}

// Loads the signed-in editor's drafts into the holder. Returns false if they aren't allowed to edit site content. A layout and its
// page render side by side, so BOTH await this before rendering anything that reads content; it runs once per request.
export const ensurePreviewDrafts = cache(async (): Promise<boolean> => {
  const userClient = await createClient();
  const { data: claims } = await userClient.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return false;
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', userId);
  if (!hasCapability(roles ?? [], 'manage_site_content')) return false;
  const { data } = await createServiceClient().from('content_drafts').select('drafts').eq('user_id', userId).maybeSingle();
  holder().drafts = (data?.drafts ?? {}) as Record<string, Record<string, unknown>>;
  return true;
});
