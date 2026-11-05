import { NextResponse } from 'next/server';
import { emailConfigured, sendOne } from '@/lib/email/mailer';
import { senderForKind } from '@/lib/email/senders';
import { parseRecipients } from '@/lib/email/recipients';
import { problemsIn } from '@/lib/newsletter/blocks';
import { authorizeNewsletter, eventsFor, kindOf, loadIssue, renderFor } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // nodemailer needs Node's network sockets
const MAX_TEST = 5;

// Send a test copy: to you, and to up to 5 more addresses you give. It looks exactly like the real email, marked as a test, and counts as the test of this version (editing the issue afterwards asks for a new one). { to?: "a@b.c, d@e.f" }
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  if (!emailConfigured()) return NextResponse.json({ error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' }, { status: 503 });
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  if (issue.status === 'sending' || issue.status === 'sent') return NextResponse.json({ error: 'It has already gone out.' }, { status: 409 });
  const problems = problemsIn(issue.title, issue.blocks);
  if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const typed = parseRecipients(typeof b.to === 'string' ? b.to : '').valid.slice(0, MAX_TEST);
  const mine = auth.user.email ? [auth.user.email.toLowerCase()] : [];
  const to = [...new Set([...mine, ...typed.map((t) => t.toLowerCase())])];
  if (!to.length) return NextResponse.json({ error: 'Add an address to send the test to.' }, { status: 400 });
  const events = await eventsFor(auth.svc, issue);
  const results = [];
  for (const addr of to) {
    const r = renderFor(issue, events, { user_id: null, subscriber_id: null }, new Map(), true);
    results.push(await sendOne({ to: addr, subject: `[Test] ${issue.title}`, text: r.text, html: r.html, sender: senderForKind(kindOf(issue.type)) }));
  }
  const sent = results.filter((r) => r.ok).length;
  if (sent) await auth.svc.from('newsletter_issues').update({ tested_version: issue.content_version }).eq('id', issue.id);
  return NextResponse.json({ sent, failed: results.length - sent, results, tested: sent > 0 }, { status: sent ? 200 : 502 });
}
