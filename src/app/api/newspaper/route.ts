import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { cleanBlocks } from '@/lib/newspaper/blocks';
import { cleanRules, isIssueType, NO_AUDIENCE, type AudienceRules } from '@/lib/newspaper/rules';
import { ISSUE_COLUMNS, UUID, authorizeNewspaper, freshSlug, loadIssue, loadEventTitle } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

const TEAM: AudienceRules = { ...NO_AUDIENCE, roles: ['exec', 'lead', 'officer', 'recruit'] };

// The Newspaper's issues (officers and above, or granted "Write the Newspaper").
//   GET                      every issue: its number, title, type, state, who wrote it and how it went
//   POST { title, type?, event_id?, copy_from? }   a new draft (an event type starts with that event's card and the people who have a ticket; copy_from copies an old issue's blocks and audience)
export async function GET() {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const { data } = await auth.svc
    .from('newspaper_issues')
    .select('id, slug, number, title, type, status, event_id, created_by, review_by, updated_at, sent_at')
    .order('number', { ascending: false })
    .limit(300);
  const issues = data ?? [];
  const ids = issues.map((i) => i.id as string);
  const [{ data: rows }, { data: people }] = await Promise.all([
    ids.length
      ? auth.svc.from('newspaper_deliveries').select('issue_id, status').in('issue_id', ids).limit(50000)
      : Promise.resolve({ data: [] as { issue_id: string; status: string }[] }),
    auth.svc
      .from('profiles')
      .select('id, display_name')
      .in('id', [...new Set(issues.map((i) => i.created_by as string | null).filter((x): x is string => !!x))]),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id as string, (p.display_name as string | null) || '']));
  return NextResponse.json({
    canSend: auth.canSend,
    issues: issues.map((i) => {
      const mine = (rows ?? []).filter((r) => r.issue_id === i.id);
      return {
        ...i,
        created_by_name: name.get(i.created_by as string) ?? '',
        sent: mine.filter((r) => r.status === 'sent').length,
        failed: mine.filter((r) => r.status === 'failed').length,
        total: mine.length,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const type = isIssueType(b.type) ? b.type : 'newspaper';
  let title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  const eventId = typeof b.event_id === 'string' && UUID.test(b.event_id) ? b.event_id : null;
  if (type !== 'newspaper' && !eventId) return NextResponse.json({ error: 'Pick the event this is about.' }, { status: 400 });
  let blocks = cleanBlocks([]);
  let audience: AudienceRules = TEAM;
  if (typeof b.copy_from === 'string' && UUID.test(b.copy_from)) {
    const from = await loadIssue(auth.svc, b.copy_from);
    if (!from) return NextResponse.json({ error: 'That issue is gone.' }, { status: 404 });
    blocks = from.blocks;
    audience = from.audience;
    title ||= `${from.title} (copy)`.slice(0, 160);
  } else if (type === 'newspaper') {
    blocks = cleanBlocks([
      { type: 'heading', text: 'This Month At Triton Gaming', size: 'large' },
      { type: 'text', text: 'Write your message here. A blank line starts a new paragraph.' },
    ]);
  } else {
    const ev = await loadEventTitle(auth.svc, eventId!);
    if (!ev) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
    title ||= type === 'event_update' ? `An update about ${ev}` : type === 'event_reminder' ? `${ev} is coming up` : `${ev} is coming`;
    blocks = cleanBlocks([
      {
        type: 'text',
        text:
          type === 'event_update'
            ? 'Here is what changed:'
            : type === 'event_reminder'
              ? 'A quick reminder: it starts soon. Your ticket is in the portal under My Tickets.'
              : 'We are excited to tell you about this one.',
      },
      { type: 'event', event_id: eventId! },
    ]);
    audience = { ...NO_AUDIENCE, events: [{ id: eventId!, who: 'ticket' }] };
  }
  if (!title) return NextResponse.json({ error: 'Give the issue a title.' }, { status: 400 });
  const slug = await freshSlug(auth.svc, title);
  const { data, error } = await auth.svc
    .from('newspaper_issues')
    .insert({ slug, title, type, event_id: eventId, blocks, audience: cleanRules(audience), created_by: auth.user.id })
    .select(ISSUE_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t make the issue.' }, { status: 500 });
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'create',
    entityType: 'newspaper',
    entityId: data.id as string,
    summary: `Started the Newspaper issue “${title}”`,
  });
  return NextResponse.json({ issue: { id: data.id, slug, number: data.number } }, { status: 201 });
}
