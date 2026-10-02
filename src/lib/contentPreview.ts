import { cache } from 'react';
import { draftHolder } from '@/lib/contentPreviewStore';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// Loads the signed-in editor's drafts into the holder. Returns false if they aren't allowed to edit site content. A layout and its
// page render side by side, so BOTH await this before rendering anything that reads content; it runs once per request.
export const ensurePreviewDrafts = cache(async (): Promise<boolean> => {
  const userClient = await createClient();
  const { data: claims } = await userClient.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return false;
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', userId);
  // Anyone who edits something with a live preview: site content, events or a division page.
  const r = roles ?? [];
  if (!hasCapability(r, 'manage_site_content') && !hasCapability(r, 'manage_events') && !hasCapability(r, 'manage_division')) return false;
  const { data } = await createServiceClient().from('content_drafts').select('drafts').eq('user_id', userId).maybeSingle();
  draftHolder().drafts = (data?.drafts ?? {}) as Record<string, Record<string, unknown>>;
  return true;
});
