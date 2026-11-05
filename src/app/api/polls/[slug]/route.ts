import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { removeUnreferencedFiles } from '@/lib/storage/removeFiles';
import { POLL_MODES, POLL_REVEALS } from '@/lib/polls/tally';
import { POLL_COLUMNS, authorizePolls, broadcast, freshCode, loadEntries, loadPollFor, results } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

// One poll, for its host (officers and above).
//   GET      the poll, its entries and the standings so far (the host sees the counts whatever the poll's reveal setting is)
//   PATCH    { name?, mode?, reveal? } settings (the way to vote can only change in a draft; the reveal setting until it is revealed) and/or
//            { action: 'open' | 'close' | 'reopen' | 'reveal' | 'clear' }   open voting (gives the code), close it, open it again, show the results to everyone (gives the code back), or throw the votes away
//   DELETE   remove the poll with its entries, pictures and votes
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const poll = await loadPollFor(auth, (await params).slug);
  if (!poll) return NextResponse.json({ error: 'That poll is gone.' }, { status: 404 });
  const entries = await loadEntries(auth.svc, poll.id);
  const r = await results(auth.svc, poll, entries);
  return NextResponse.json({ poll, entries, standings: r.standings, voters: r.voters });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const poll = await loadPollFor(auth, (await params).slug);
  if (!poll) return NextResponse.json({ error: 'That poll is gone.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string') {
    const n = b.name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!n) return NextResponse.json({ error: 'Give the poll a name.' }, { status: 400 });
    patch.name = n;
  }
  if (b.mode !== undefined) {
    if (!(POLL_MODES as readonly string[]).includes(b.mode)) return NextResponse.json({ error: 'That isn’t a way to vote.' }, { status: 400 });
    if (b.mode !== poll.mode) {
      if (poll.status !== 'draft') return NextResponse.json({ error: 'The way to vote can’t change once voting has opened.' }, { status: 409 });
      patch.mode = b.mode;
    }
  }
  if (b.reveal !== undefined) {
    if (!(POLL_REVEALS as readonly string[]).includes(b.reveal)) return NextResponse.json({ error: 'That isn’t a way to show results.' }, { status: 400 });
    if (poll.status === 'revealed') return NextResponse.json({ error: 'The results are already shown.' }, { status: 409 });
    patch.reveal = b.reveal;
  }
  let announce: string | null = null;
  if (typeof b.action === 'string') {
    const now = new Date().toISOString();
    switch (b.action) {
      case 'open': {
        if (poll.status !== 'draft') return NextResponse.json({ error: poll.status === 'open' ? 'Voting is already open.' : 'This poll has already been run.' }, { status: 409 });
        const { count } = await auth.svc.from('poll_entries').select('id', { count: 'exact', head: true }).eq('poll_id', poll.id);
        if ((count ?? 0) < 2) return NextResponse.json({ error: 'Add at least two entries before opening voting.' }, { status: 409 });
        const code = await freshCode(auth.svc);
        if (!code) return NextResponse.json({ error: 'Couldn’t find a free code. Try again.' }, { status: 500 });
        Object.assign(patch, { status: 'open', code, opened_at: now });
        announce = 'open';
        break;
      }
      case 'close':
        if (poll.status !== 'open') return NextResponse.json({ error: 'Only an open poll can be closed.' }, { status: 409 });
        Object.assign(patch, { status: 'closed', closed_at: now });
        announce = 'closed';
        break;
      case 'reopen':
        if (poll.status !== 'closed') return NextResponse.json({ error: 'Only a closed poll can be opened again.' }, { status: 409 });
        Object.assign(patch, { status: 'open', closed_at: null });
        announce = 'open';
        break;
      case 'reveal':
        if (poll.status !== 'open' && poll.status !== 'closed')
          return NextResponse.json({ error: poll.status === 'revealed' ? 'The results are already shown.' : 'Open voting first.' }, { status: 409 });
        Object.assign(patch, { status: 'revealed', code: null, closed_at: poll.closed_at ?? now }); // the code is given back for another poll or game
        announce = 'revealed';
        break;
      case 'clear':
        if (poll.status === 'revealed') return NextResponse.json({ error: 'The results are already shown.' }, { status: 409 });
        await auth.svc.from('poll_votes').delete().eq('poll_id', poll.id);
        announce = 'cleared';
        break;
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  }
  const { data, error } = await auth.svc.from('polls').update(patch).eq('id', poll.id).select(POLL_COLUMNS).single();
  if (error || !data)
    return NextResponse.json({ error: error?.code === '23505' ? 'That code was just taken. Try again.' : 'Couldn’t save that.' }, { status: error?.code === '23505' ? 409 : 500 });
  if (announce) {
    await broadcast(poll.id, 'state', { status: data.status });
    await logAudit(auth.svc, {
      actorId: auth.user.id,
      action: 'update',
      entityType: 'poll',
      entityId: poll.id,
      summary: `${announce === 'open' ? 'Opened voting in' : announce === 'closed' ? 'Closed voting in' : announce === 'revealed' ? 'Revealed the results of' : 'Cleared the votes of'} the poll “${data.name}”`,
    });
  }
  const entries = await loadEntries(auth.svc, poll.id);
  const r = await results(auth.svc, data as typeof poll, entries);
  return NextResponse.json({ poll: data, entries, standings: r.standings, voters: r.voters });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const poll = await loadPollFor(auth, (await params).slug);
  if (!poll) return NextResponse.json({ ok: true });
  if (poll.status === 'open') return NextResponse.json({ error: 'Voting is open. Close it first.' }, { status: 409 });
  const entries = await loadEntries(auth.svc, poll.id);
  await auth.svc.from('polls').delete().eq('id', poll.id); // its entries and votes go with it
  await removeUnreferencedFiles(
    auth.svc,
    entries.map((e) => e.image),
  );
  await broadcast(poll.id, 'state', { status: 'gone' });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'poll', entityId: poll.id, summary: `Deleted the poll “${poll.name}”` });
  return NextResponse.json({ ok: true });
}
