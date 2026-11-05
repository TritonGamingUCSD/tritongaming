import { NextResponse } from 'next/server';
import { cleanBlocks } from '@/lib/newsletter/blocks';
import { isIssueType } from '@/lib/newsletter/rules';
import { authorizeNewsletter, loadIssue, previewHtml } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';

// The email as it would look, for the editor's preview: POST the draft's current title, type and blocks (nothing is saved) and get the HTML back.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const html = await previewHtml(auth.svc, {
    ...issue,
    title: typeof b.title === 'string' ? b.title.trim().slice(0, 160) || issue.title : issue.title,
    preheader: typeof b.preheader === 'string' ? b.preheader.trim().slice(0, 140) : issue.preheader,
    type: isIssueType(b.type) ? b.type : issue.type,
    event_id: typeof b.event_id === 'string' ? b.event_id : issue.event_id,
    blocks: Array.isArray(b.blocks) ? cleanBlocks(b.blocks) : issue.blocks,
  });
  return NextResponse.json({ html });
}
