import { NextResponse } from 'next/server';
import { cleanVotes } from '@/lib/polls/tally';
import { UUID, authorizePolls, broadcast, loadEntries, loadPoll } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// Cast (or change) your vote: { votes: [{ entry_id, value }] } by the poll's id. Only while voting is open; the vote replaces the one you had before, so it can be changed until the host closes voting. One person (one phone's session) has one set of
// votes. The host's screen is told how many have voted.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const { key } = await params;
  const poll = UUID.test(key) ? await loadPoll(auth.svc, key) : null;
  if (!poll || poll.status === 'draft') return NextResponse.json({ error: 'There is no poll with that code.' }, { status: 404 });
  if (poll.status !== 'open') return NextResponse.json({ error: poll.status === 'closed' ? 'Voting is closed.' : 'This poll is over.', closed: true }, { status: 409 });
  const entries = await loadEntries(auth.svc, poll.id);
  const b = await request.json().catch(() => ({}));
  const clean = cleanVotes(
    poll.mode,
    entries.map((e) => e.id),
    b.votes,
  );
  if ('error' in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
  const del = await auth.svc.from('poll_votes').delete().eq('poll_id', poll.id).eq('user_id', auth.user.id);
  if (del.error) return NextResponse.json({ error: 'Couldn’t save your vote. Try again.' }, { status: 500 });
  const ins = await auth.svc.from('poll_votes').insert(clean.votes.map((v) => ({ poll_id: poll.id, user_id: auth.user.id, entry_id: v.entry_id, value: v.value })));
  if (ins.error) return NextResponse.json({ error: 'Couldn’t save your vote. Try again.' }, { status: 500 });
  await broadcast(poll.id, 'voted', {}, true);
  return NextResponse.json({ mine: clean.votes });
}
