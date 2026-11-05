import { NextResponse } from 'next/server';
import { resolveAudience } from '@/lib/newsletter/audience';
import { cleanRules } from '@/lib/newsletter/rules';
import { authorizeNewsletter, kindOf, loadIssue } from '@/lib/newsletter/server';
import { quotaLeft, sentLastDay } from '@/lib/newsletter/view';

export const dynamic = 'force-dynamic';

// Who would get this issue with these rules (the editor asks as the picks change): how many people, how many were skipped and why, and what is left of today's sending limit. Nothing is saved or sent.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const aud = await resolveAudience(auth.svc, 'rules' in b ? cleanRules(b.rules) : issue.audience, kindOf(issue.type));
  return NextResponse.json({
    total: aud.people.length,
    accounts: aud.people.length - aud.subscribers,
    subscribers: aud.subscribers,
    skippedOptOut: aud.skippedOptOut,
    skippedNoEmail: aud.skippedNoEmail,
    left: quotaLeft(await sentLastDay(auth.svc)),
    sample: aud.people.slice(0, 8).map((p) => p.name || p.email.replace(/(.).*(@.*)/, '$1…$2')),
  });
}
