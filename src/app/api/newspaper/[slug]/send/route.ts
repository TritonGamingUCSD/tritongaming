import { NextResponse } from 'next/server';
import { emailConfigured, sendOne } from '@/lib/email/mailer';
import { senderForKind } from '@/lib/email/senders';
import { logAudit } from '@/lib/notifications/audit';
import { problemsIn } from '@/lib/newspaper/blocks';
import { resolveAudience } from '@/lib/newspaper/audience';
import { rulesEmpty } from '@/lib/newspaper/rules';
import { BATCH, authorizeNewspaper, eventsFor, kindOf, loadIssue, numberLinks, renderFor } from '@/lib/newspaper/server';
import { issueView, quotaLeft, resultsOf, sentLastDay } from '@/lib/newspaper/view';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // nodemailer needs Node's network sockets
export const maxDuration = 60;

// Sending an issue (exec, admins, or granted "Send the Newspaper"). Three steps, each safe to repeat:
//   { action: 'start' }   the issue was sent for checking, someone other than the writer reads it, a test of this version was sent, and a person confirmed: the people who get it are written down (one row each) and it is now 'sending'
//   { action: 'batch' }   sends the next 40 of them; the page calls again until nothing is left. A batch claims its people first, so two pages can't send one person twice; a batch that died is picked up again after 5 minutes
//   { action: 'retry' }   puts the failed ones back to be sent again
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewspaper('send');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const view = async (extra: object = {}) => ({ ...(await issueView(auth.svc, (await loadIssue(auth.svc, issue.id))!, true)), canSend: true, me: auth.user.id, ...extra });

  if (b.action === 'start') {
    if (!emailConfigured()) return NextResponse.json({ error: 'Email isn’t set up yet (GMAIL_USER and GMAIL_APP_PASSWORD).' }, { status: 503 });
    if (issue.status !== 'review')
      return NextResponse.json({ error: issue.status === 'draft' ? 'It has to be sent for checking first.' : 'It has already gone out.' }, { status: 409 });
    if (issue.review_by === auth.user.id || issue.created_by === auth.user.id)
      return NextResponse.json({ error: 'You wrote this one, so someone else has to check and send it.' }, { status: 403 });
    if (issue.tested_version !== issue.content_version) return NextResponse.json({ error: 'Send a test of this version first.', needsTest: true }, { status: 409 });
    const problems = problemsIn(issue.title, issue.blocks);
    if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 409 });
    if (rulesEmpty(issue.audience)) return NextResponse.json({ error: 'Pick who gets it first.' }, { status: 409 });
    const aud = await resolveAudience(auth.svc, issue.audience, kindOf(issue.type));
    if (!aud.people.length) return NextResponse.json({ error: 'Nobody would get this (everyone matched opted out or has no address).' }, { status: 409 });
    const left = quotaLeft(await sentLastDay(auth.svc));
    if (aud.people.length > left)
      return NextResponse.json(
        { error: `That is ${aud.people.length} emails and only ${left} are left of today’s sending limit. Narrow the audience, or send tomorrow.` },
        { status: 409 },
      );
    // claim the issue first, so two people pressing Send together start it once
    const { data: claimed } = await auth.svc
      .from('newspaper_issues')
      .update({ status: 'sending', sent_by: auth.user.id, started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', issue.id)
      .eq('status', 'review')
      .select('id');
    if (!claimed?.length) return NextResponse.json({ error: 'Someone else just started it.' }, { status: 409 });
    for (let i = 0; i < aud.people.length; i += 500)
      await auth.svc
        .from('newspaper_deliveries')
        .insert(aud.people.slice(i, i + 500).map((p) => ({ issue_id: issue.id, user_id: p.user_id, subscriber_id: p.subscriber_id, name: p.name, email: p.email })));
    const links = numberLinks(issue, await eventsFor(auth.svc, issue));
    if (links.size) await auth.svc.from('newspaper_links').insert([...links].map(([url, n]) => ({ issue_id: issue.id, n, url })));
    await logAudit(auth.svc, {
      actorId: auth.user.id,
      action: 'update',
      entityType: 'newspaper',
      entityId: issue.id,
      summary: `Started sending the Newspaper issue “${issue.title}”, to ${aud.people.length} people`,
    });
    return NextResponse.json(await view({ total: aud.people.length }));
  }

  if (b.action === 'retry') {
    if (issue.status !== 'sent') return NextResponse.json({ error: 'Only an issue that has gone out can be retried.' }, { status: 409 });
    const { data } = await auth.svc
      .from('newspaper_deliveries')
      .update({ status: 'pending', error: null, claimed_at: null })
      .eq('issue_id', issue.id)
      .eq('status', 'failed')
      .select('id');
    if (!data?.length) return NextResponse.json({ error: 'Nothing failed.' }, { status: 409 });
    await auth.svc.from('newspaper_issues').update({ status: 'sending', updated_at: new Date().toISOString() }).eq('id', issue.id);
    return NextResponse.json(await view());
  }

  if (b.action === 'batch') {
    if (issue.status !== 'sending') return NextResponse.json({ ...(await view()), done: issue.status === 'sent' });
    const stale = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: open } = await auth.svc
      .from('newspaper_deliveries')
      .select('id')
      .eq('issue_id', issue.id)
      .eq('status', 'pending')
      .or(`claimed_at.is.null,claimed_at.lt.${stale}`)
      .order('email')
      .limit(BATCH);
    const ids = (open ?? []).map((r) => r.id as string);
    let mine: { id: string; user_id: string | null; subscriber_id: string | null; email: string }[] = [];
    if (ids.length) {
      const { data } = await auth.svc
        .from('newspaper_deliveries')
        .update({ claimed_at: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'pending')
        .or(`claimed_at.is.null,claimed_at.lt.${stale}`)
        .select('id, user_id, subscriber_id, email');
      mine = (data ?? []) as typeof mine;
    }
    const events = await eventsFor(auth.svc, issue);
    const { data: linkRows } = await auth.svc.from('newspaper_links').select('n, url').eq('issue_id', issue.id);
    const links = new Map((linkRows ?? []).map((l) => [l.url as string, l.n as number]));
    for (const p of mine) {
      const r = renderFor(issue, events, p, links);
      const res = await sendOne({ to: p.email, subject: issue.title, text: r.text, html: r.html, sender: senderForKind(kindOf(issue.type)), unsubscribeUrl: r.unsubscribeUrl });
      await auth.svc
        .from('newspaper_deliveries')
        .update(res.ok ? { status: 'sent', sent_at: new Date().toISOString(), error: null } : { status: 'failed', error: (res.error ?? 'Couldn’t send it.').slice(0, 300) })
        .eq('id', p.id);
    }
    const { count: pending } = await auth.svc.from('newspaper_deliveries').select('id', { count: 'exact', head: true }).eq('issue_id', issue.id).eq('status', 'pending');
    let done = false;
    if (!pending) {
      const { data: fin } = await auth.svc
        .from('newspaper_issues')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', issue.id)
        .eq('status', 'sending')
        .select('id');
      done = true;
      if (fin?.length) {
        const r = await resultsOf(auth.svc, issue.id, false);
        await logAudit(auth.svc, {
          actorId: auth.user.id,
          action: 'update',
          entityType: 'newspaper',
          entityId: issue.id,
          summary: `The Newspaper issue “${issue.title}” went out: ${r.sent} sent, ${r.failed} failed`,
        });
      }
    }
    return NextResponse.json(await view({ done, batch: mine.length }));
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
