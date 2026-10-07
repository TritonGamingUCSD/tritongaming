import { createServiceClient } from '@/lib/supabase/admin';

/** Tells everyone with the documentation open that something changed (a page was published, moved, renamed, deleted…), so their page refreshes right
 *  away instead of asking every minute. Failing to send is harmless: pages also refresh slowly on their own. */
// The browser side (docs/DocsClient.tsx) listens on this same name.
const DOCS_CHANNEL = 'docs-live';

export async function notifyDocs() {
  const send = async () => {
    const svc = createServiceClient();
    const channel = svc.channel(DOCS_CHANNEL);
    const sent = await channel.httpSend('changed', {});
    if (!sent.success) console.warn('docs broadcast was not accepted', sent);
    await svc.removeChannel(channel);
  };
  try { await Promise.race([send(), new Promise((resolve) => setTimeout(resolve, 1500))]); } catch (e) { console.warn('docs broadcast failed', e); }
}
