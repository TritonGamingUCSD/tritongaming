import { NextResponse } from 'next/server';
import { CODE, UUID, authorizePolls, loadEntries, loadPoll, results } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// A poll as a voter sees it (anyone with a session, a guest too): by its 6-digit code (to join) or its id (to keep following it after the code is given back). A draft is not visible. The entries, the poll's state and the voter's own
// votes are given; the standings only once the host has revealed them, never before.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const { key } = await params;
  const poll = UUID.test(key) || CODE.test(key) ? await loadPoll(auth.svc, key) : null;
  if (!poll || poll.status === 'draft') return NextResponse.json({ error: 'There is no poll with that code.' }, { status: 404 });
  if (CODE.test(key) && poll.status === 'revealed') return NextResponse.json({ error: 'There is no poll with that code.' }, { status: 404 });
  const entries = await loadEntries(auth.svc, poll.id);
  const { data: mine } = await auth.svc.from('poll_votes').select('entry_id, value').eq('poll_id', poll.id).eq('user_id', auth.user.id);
  const shown = poll.status === 'revealed' ? await results(auth.svc, poll, entries) : null;
  return NextResponse.json({
    poll: { id: poll.id, name: poll.name, mode: poll.mode, status: poll.status },
    entries,
    mine: mine ?? [],
    standings: shown?.standings ?? null,
    voters: shown?.voters ?? null,
  });
}
