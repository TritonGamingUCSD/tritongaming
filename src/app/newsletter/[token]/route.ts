import { createServiceClient } from '@/lib/supabase/admin';
import { loadIssue, previewHtml } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';

// The web copy of an issue that has gone out: "View in your browser" in the email opens this. The address is unguessable and the page is not listed anywhere or offered to search engines. Drafts and issues under review are never shown.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = createServiceClient();
  const { data } = /^[0-9a-f]{32}$/.test(token) ? await svc.from('newsletter_issues').select('id, status').eq('web_token', token).maybeSingle() : { data: null };
  const issue = data && (data.status === 'sending' || data.status === 'sent') ? await loadIssue(svc, data.id as string) : null;
  if (!issue)
    return new Response('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font-family:sans-serif;padding:2rem">That issue isn’t here.</p>', {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    });
  return new Response(await previewHtml(svc, issue), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'public, max-age=300' },
  });
}
