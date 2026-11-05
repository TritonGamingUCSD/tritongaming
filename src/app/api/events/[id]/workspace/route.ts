import { NextResponse } from 'next/server';
import { UUID, authorizeWorkspace } from '@/lib/events/workspace';

export const dynamic = 'force-dynamic';

// An event's workspace: what is tied to it, for the tabs of its page. Every part is only worked out for people who may see it (see lib/events/workspace.ts).
//   GET            the event, how many registered and checked in, its logistics plan, the Newsletter issues about it, and the polls, Q&A, Trivia games, photo booths and Staffles made for it
//   PUT { kind, id, on }   tie an existing poll | qa | trivia | booth | staffle to this event (on: true) or take it off (on: false)
const TOOL = {
  poll: { table: 'polls', cap: 'polls' },
  qa: { table: 'qa_sessions', cap: 'polls' },
  trivia: { table: 'trivia_games', cap: 'polls' },
  booth: { table: 'photobooths', cap: 'booths' },
  staffle: { table: 'staffles', cap: 'staffles' },
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeWorkspace();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { svc, caps } = auth;
  const { data: event } = await svc.from('events').select('id, title, slug, start_date, end_date, location, is_published, is_online, points_value').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  const [tix, plan, issues, polls, qa, trivia, booths, staffles, feedback] = await Promise.all([
    caps.tickets ? svc.from('tickets').select('status, checked_in_at').eq('event_id', id).neq('status', 'cancelled').limit(20000) : Promise.resolve({ data: null }),
    caps.logistics ? svc.from('logistics_plans').select('slug, name, status').eq('event_id', id).limit(5) : Promise.resolve({ data: null }),
    caps.email
      ? svc.from('newsletter_issues').select('id, slug, number, title, type, status').eq('event_id', id).order('updated_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: null }),
    caps.polls ? svc.from('polls').select('id, slug, name, status').eq('event_id', id).limit(30) : Promise.resolve({ data: null }),
    caps.polls ? svc.from('qa_sessions').select('id, slug, name, status').eq('event_id', id).limit(30) : Promise.resolve({ data: null }),
    caps.polls ? svc.from('trivia_games').select('code, status, trivia_quizzes(name)').eq('event_id', id).limit(30) : Promise.resolve({ data: null }),
    caps.booths ? svc.from('photobooths').select('id, slug, name').eq('event_id', id).limit(30) : Promise.resolve({ data: null }),
    caps.staffles ? svc.from('staffles').select('id, slug, name, status').eq('event_id', id).limit(30) : Promise.resolve({ data: null }),
    caps.tickets ? svc.from('event_feedback').select('event_id', { count: 'exact', head: true }).eq('event_id', id) : Promise.resolve({ count: null }),
  ]);
  const t = tix.data as { status: string; checked_in_at: string | null }[] | null;
  const issueIds = (issues.data ?? []).map((i) => i.id as string);
  const { data: deliveries } = issueIds.length
    ? await svc.from('newsletter_deliveries').select('issue_id, status').in('issue_id', issueIds).limit(50000)
    : { data: [] as { issue_id: string; status: string }[] };
  return NextResponse.json({
    event,
    caps,
    tickets: t ? { registered: t.length, checkedIn: t.filter((x) => x.checked_in_at || x.status === 'used').length } : null,
    plans: plan.data ?? null,
    issues: issues.data
      ? issues.data.map((i) => {
          const mine = (deliveries ?? []).filter((d) => d.issue_id === i.id);
          return { slug: i.slug, number: i.number, title: i.title, type: i.type, status: i.status, sent: mine.filter((d) => d.status === 'sent').length, total: mine.length };
        })
      : null,
    tools: {
      polls: polls.data ?? null,
      qa: qa.data ?? null,
      trivia: trivia.data
        ? trivia.data.map((g) => ({
            code: g.code,
            status: g.status,
            name:
              (g.trivia_quizzes as unknown as { name: string } | { name: string }[] | null) &&
              ((Array.isArray(g.trivia_quizzes) ? g.trivia_quizzes[0]?.name : (g.trivia_quizzes as { name: string }).name) ?? 'Trivia'),
          }))
        : null,
      booths: booths.data ?? null,
      staffles: staffles.data ?? null,
    },
    feedback: feedback.count ?? null,
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeWorkspace();
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const kind = typeof b.kind === 'string' && b.kind in TOOL ? (b.kind as keyof typeof TOOL) : null;
  if (!UUID.test(id) || !kind || typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'Pick what to tie to the event.' }, { status: 400 });
  if (!auth.caps[TOOL[kind].cap]) return NextResponse.json({ error: 'That is not yours to change.' }, { status: 403 });
  const { data: ev } = await auth.svc.from('events').select('id').eq('id', id).maybeSingle();
  if (!ev) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  const { data } = await auth.svc
    .from(TOOL[kind].table)
    .update({ event_id: b.on === false ? null : id })
    .eq('id', b.id)
    .select('id');
  if (!data?.length) return NextResponse.json({ error: 'That one is gone.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
