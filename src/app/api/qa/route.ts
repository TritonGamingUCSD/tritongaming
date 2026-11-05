import { NextResponse } from 'next/server';
import { NO_SUCH_EVENT, eventLink } from '@/lib/events/forEvent';
import { liveListFilter, newItemOwner } from '@/lib/divisions/liveAccess';
import { logAudit } from '@/lib/notifications/audit';
import { authorizePolls } from '@/lib/polls/server';
import { cleanText } from '@/lib/qa/rank';
import { QA_COLUMNS, freshQaSlug, type QaSessionRow } from '@/lib/qa/server';

export const dynamic = 'force-dynamic';

// Q&A sessions (officers and above, the Trivia permission).
//   GET              every session with how many questions are waiting, shown and answered
//   POST { name }    make a session (a draft: open it when the event starts, which gives the code)
export async function GET() {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const filter = liveListFilter(auth.scope);
  let q = auth.svc.from('qa_sessions').select(QA_COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (filter) q = q.or(filter);
  const { data } = await q;
  const sessions = (data ?? []) as QaSessionRow[];
  const ids = sessions.map((s) => s.id);
  const { data: qs } = ids.length
    ? await auth.svc.from('qa_questions').select('session_id, status').in('session_id', ids).limit(20000)
    : { data: [] as { session_id: string; status: string }[] };
  return NextResponse.json({
    sessions: sessions.map((s) => {
      const mine = (qs ?? []).filter((q) => q.session_id === s.id);
      const n = (status: string) => mine.filter((q) => q.status === status).length;
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        status: s.status,
        code: s.code,
        created_at: s.created_at,
        division_id: s.division_id,
        pending: n('pending'),
        approved: n('approved'),
        answered: n('answered'),
        total: mine.length,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await authorizePolls('host', 'Q&A');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = cleanText(b.name, 80);
  if (!name) return NextResponse.json({ error: 'Give the Q&A a name.' }, { status: 400 });
  const owner = newItemOwner(auth.scope, b.division_id);
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: 403 });
  const link = await eventLink(auth.svc, b.event_id);
  if (!link.ok) return NextResponse.json({ error: NO_SUCH_EVENT }, { status: 404 });
  const slug = await freshQaSlug(auth.svc, name);
  const { data, error } = await auth.svc
    .from('qa_sessions')
    .insert({ slug, name, created_by: auth.user.id, event_id: link.id ?? null, division_id: owner.division_id })
    .select(QA_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t make the Q&A.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'qa', entityId: data.id as string, summary: `Made the Q&A “${name}”` });
  return NextResponse.json({ session: data }, { status: 201 });
}
