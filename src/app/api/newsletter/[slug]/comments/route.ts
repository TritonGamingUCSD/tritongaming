import { NextResponse } from 'next/server';
import { authorizeNewsletter, loadIssue } from '@/lib/newsletter/server';
import { issueView } from '@/lib/newsletter/view';

export const dynamic = 'force-dynamic';

// A note on an issue (from a writer or a sender), shown in its thread. { body }
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const body = typeof b.body === 'string' ? b.body.trim().slice(0, 1000) : '';
  if (!body) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });
  await auth.svc.from('newsletter_comments').insert({ issue_id: issue.id, user_id: auth.user.id, body });
  return NextResponse.json({ ...(await issueView(auth.svc, issue, auth.canSend)), canSend: auth.canSend, me: auth.user.id });
}
