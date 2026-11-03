import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { cleanBlocks, problemsIn } from '@/lib/newspaper/blocks';
import { cleanRules, isIssueType, rulesEmpty } from '@/lib/newspaper/rules';
import { UUID, authorizeNewspaper, loadIssue } from '@/lib/newspaper/server';
import { issueView } from '@/lib/newspaper/view';

export const dynamic = 'force-dynamic';

// One issue. GET: the issue, comments, what is missing, and (once sent) the results.
// PATCH (the writer): the fields of a draft, or { action }: request_review · withdraw (back to a draft) · and, for a sender, send_back { comment? } (back to the writer with a note). Any change to what the email says clears the test that was sent.
// DELETE: a draft or an issue under review (a sent one stays on record).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const v = await issueView(auth.svc, issue, auth.canSend);
  return NextResponse.json({ ...v, canSend: auth.canSend, me: auth.user.id });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  const fields = ['title', 'preheader', 'type', 'event_id', 'blocks'].some((k) => k in b);
  if (fields || 'audience' in b || 'list_id' in b) {
    if (issue.status !== 'draft')
      return NextResponse.json({ error: issue.status === 'review' ? 'It is waiting to be checked. Withdraw it to change it.' : 'It has already gone out.' }, { status: 409 });
  }
  let changed = false;
  if (typeof b.title === 'string') {
    const t = b.title.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!t) return NextResponse.json({ error: 'Give the issue a title.' }, { status: 400 });
    if (t !== issue.title) {
      patch.title = t;
      changed = true;
    }
  }
  if (typeof b.preheader === 'string') {
    const p = b.preheader.replace(/\s+/g, ' ').trim().slice(0, 140);
    if (p !== issue.preheader) {
      patch.preheader = p;
      changed = true;
    }
  }
  if (b.type !== undefined) {
    if (!isIssueType(b.type)) return NextResponse.json({ error: 'That isn’t a kind of issue.' }, { status: 400 });
    if (b.type !== issue.type) {
      patch.type = b.type;
      changed = true;
    }
  }
  if ('event_id' in b) {
    const e = typeof b.event_id === 'string' && UUID.test(b.event_id) ? b.event_id : null;
    if (e !== issue.event_id) {
      patch.event_id = e;
      changed = true;
    }
  }
  if (Array.isArray(b.blocks)) {
    const blocks = cleanBlocks(b.blocks);
    if (JSON.stringify(blocks) !== JSON.stringify(issue.blocks)) {
      patch.blocks = blocks;
      changed = true;
    }
  }
  if ('audience' in b) patch.audience = cleanRules(b.audience);
  if ('list_id' in b) patch.list_id = typeof b.list_id === 'string' && UUID.test(b.list_id) ? b.list_id : null;
  if (changed) patch.content_version = issue.content_version + 1;
  const type = (patch.type as string | undefined) ?? issue.type;
  if (type !== 'newspaper' && !((patch.event_id as string | null | undefined) ?? issue.event_id))
    return NextResponse.json({ error: 'An event announcement or update needs its event.' }, { status: 400 });

  let said = '';
  if (typeof b.action === 'string') {
    switch (b.action) {
      case 'request_review': {
        if (issue.status !== 'draft') return NextResponse.json({ error: 'Only a draft can be sent for checking.' }, { status: 409 });
        const merged = { title: (patch.title as string) ?? issue.title, blocks: (patch.blocks as typeof issue.blocks) ?? issue.blocks };
        const problems = problemsIn(merged.title, merged.blocks);
        if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 409 });
        if (rulesEmpty(cleanRules(patch.audience ?? issue.audience))) return NextResponse.json({ error: 'Pick who gets it first.' }, { status: 409 });
        Object.assign(patch, { status: 'review', review_by: auth.user.id, review_at: now });
        said = 'Asked for a check of';
        break;
      }
      case 'withdraw':
        if (issue.status !== 'review') return NextResponse.json({ error: 'It isn’t waiting to be checked.' }, { status: 409 });
        if (issue.review_by !== auth.user.id && !auth.canSend)
          return NextResponse.json({ error: 'Only the person who asked for the check, or a sender, can take it back.' }, { status: 403 });
        Object.assign(patch, { status: 'draft', review_by: null, review_at: null });
        said = 'Took back for editing';
        break;
      case 'send_back': {
        if (!auth.canSend) return NextResponse.json({ error: 'Only a sender can send an issue back.' }, { status: 403 });
        if (issue.status !== 'review') return NextResponse.json({ error: 'It isn’t waiting to be checked.' }, { status: 409 });
        const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 1000) : '';
        if (comment) await auth.svc.from('newspaper_comments').insert({ issue_id: issue.id, user_id: auth.user.id, body: comment });
        Object.assign(patch, { status: 'draft', review_by: null, review_at: null });
        said = 'Sent back to its writer';
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  }
  const { error } = await auth.svc.from('newspaper_issues').update(patch).eq('id', issue.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (said)
    await logAudit(auth.svc, {
      actorId: auth.user.id,
      action: 'update',
      entityType: 'newspaper',
      entityId: issue.id,
      summary: `${said} Newspaper issue ${issue.number}, “${issue.title}”`,
    });
  const fresh = (await loadIssue(auth.svc, issue.id))!;
  return NextResponse.json({ ...(await issueView(auth.svc, fresh, auth.canSend)), canSend: auth.canSend, me: auth.user.id });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const issue = await loadIssue(auth.svc, (await params).slug);
  if (!issue) return NextResponse.json({ ok: true });
  if (issue.status === 'sending' || issue.status === 'sent') return NextResponse.json({ error: 'An issue that has gone out stays on record.' }, { status: 409 });
  await auth.svc.from('newspaper_issues').delete().eq('id', issue.id);
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'delete',
    entityType: 'newspaper',
    entityId: issue.id,
    summary: `Deleted Newspaper issue ${issue.number}, “${issue.title}”`,
  });
  return NextResponse.json({ ok: true });
}
