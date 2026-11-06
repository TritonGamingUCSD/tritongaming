import { guardDivisionLive, guardFeature } from '@/lib/portal/featureGuard';
import { NextResponse } from 'next/server';
import { NO_SUCH_EVENT, eventLink } from '@/lib/events/forEvent';
import { liveListFilter, newItemOwner } from '@/lib/divisions/liveAccess';
import { logAudit } from '@/lib/notifications/audit';
import { POLL_MODES, POLL_REVEALS } from '@/lib/polls/tally';
import { refuseBlocked } from '@/lib/wordfilter/server';
import { POLL_COLUMNS, authorizePolls, freshSlug, type PollRow } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// Polls (officers and above, the Trivia permission).
//   GET                         every poll with how many entries and how many people have voted
//   POST { name, mode?, reveal? }   make a poll (a draft: add its entries, then open it)
export async function GET() {
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const filter = liveListFilter(auth.scope);
  let q = auth.svc.from('polls').select(POLL_COLUMNS).order('created_at', { ascending: false }).limit(200);
  if (filter) q = q.or(filter);
  const { data } = await q;
  const polls = (data ?? []) as PollRow[];
  const ids = polls.map((p) => p.id);
  const [{ data: entries }, { data: votes }] = ids.length
    ? await Promise.all([
        auth.svc.from('poll_entries').select('poll_id, image').in('poll_id', ids).limit(5000),
        auth.svc.from('poll_votes').select('poll_id, user_id').in('poll_id', ids).limit(50000),
      ])
    : [{ data: [] as { poll_id: string; image: string }[] }, { data: [] as { poll_id: string; user_id: string }[] }];
  return NextResponse.json({
    polls: polls.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      mode: p.mode,
      reveal: p.reveal,
      status: p.status,
      code: p.code,
      created_at: p.created_at,
      division_id: p.division_id,
      entries: (entries ?? []).filter((e) => e.poll_id === p.id).length,
      photos: (entries ?? [])
        .filter((e) => e.poll_id === p.id && e.image)
        .map((e) => e.image as string)
        .slice(0, 4),
      voters: new Set((votes ?? []).filter((v) => v.poll_id === p.id).map((v) => v.user_id as string)).size,
    })),
  });
}

export async function POST(request: Request) {
  const off = await guardFeature('polls');
  if (off) return off;
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Give the poll a name.' }, { status: 400 });
  const blocked = await refuseBlocked({ Name: name });
  if (blocked) return blocked;
  const mode = (POLL_MODES as readonly string[]).includes(b.mode) ? b.mode : 'one';
  const reveal = (POLL_REVEALS as readonly string[]).includes(b.reveal) ? b.reveal : 'live';
  const divOff = await guardDivisionLive(b.division_id);
  if (divOff) return divOff;
  const owner = newItemOwner(auth.scope, b.division_id);
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: 403 });
  const link = await eventLink(auth.svc, b.event_id);
  if (!link.ok) return NextResponse.json({ error: NO_SUCH_EVENT }, { status: 404 });
  const slug = await freshSlug(auth.svc, name);
  const { data, error } = await auth.svc
    .from('polls')
    .insert({ slug, name, mode, reveal, created_by: auth.user.id, event_id: link.id ?? null, division_id: owner.division_id })
    .select(POLL_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t make the poll.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'poll', entityId: data.id as string, summary: `Made the poll “${name}”` });
  return NextResponse.json({ poll: data }, { status: 201 });
}
