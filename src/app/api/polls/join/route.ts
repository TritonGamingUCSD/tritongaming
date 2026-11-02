import { NextResponse } from 'next/server';
import { CODE, authorizePolls, loadPoll } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// The portal's code box asks here when six digits are not a meeting, ticket or Trivia code: is it a poll that is open for voting? (Anyone signed in may ask, a guest too; nothing is changed.) { code } → 200 { id } or 404 / 409 with the reason.
export async function POST(request: Request) {
  const auth = await authorizePolls('vote');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  const poll = CODE.test(code) ? await loadPoll(auth.svc, code) : null;
  if (!poll || poll.status === 'draft' || poll.status === 'revealed') return NextResponse.json({ error: 'There is no poll with that code.' }, { status: 404 });
  if (poll.status === 'closed') return NextResponse.json({ error: 'Voting in that poll is closed.' }, { status: 409 });
  return NextResponse.json({ id: poll.id, name: poll.name });
}
