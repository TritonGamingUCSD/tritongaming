import { NextResponse } from 'next/server';
import { refuseBlocked } from '@/lib/wordfilter/server';
import { MAX_ENTRIES, authorizePolls, loadEntries, loadPollFor } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

// Add an entry to a poll (officers and above), while it is still a draft: { name, subtitle?, number? }. Without a number it gets the next one. Gives the poll's entries.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizePolls('host');
  if (auth.error) return auth.error;
  const poll = await loadPollFor(auth, (await params).slug);
  if (!poll) return NextResponse.json({ error: 'That poll is gone.' }, { status: 404 });
  if (poll.status !== 'draft') return NextResponse.json({ error: 'Entries can only be added before voting opens.' }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name, 80);
  if (!name) return NextResponse.json({ error: 'Give the entry a name.' }, { status: 400 });
  const blocked = await refuseBlocked({ Name: name, Subtitle: clean(b.subtitle, 120) });
  if (blocked) return blocked;
  const entries = await loadEntries(auth.svc, poll.id);
  if (entries.length >= MAX_ENTRIES) return NextResponse.json({ error: `A poll can have up to ${MAX_ENTRIES} entries.` }, { status: 409 });
  const wanted = Math.round(Number(b.number));
  const number = Number.isFinite(wanted) && wanted >= 1 && wanted <= 999 ? wanted : Math.max(0, ...entries.map((e) => e.number)) + 1;
  if (entries.some((e) => e.number === number)) return NextResponse.json({ error: `Number ${number} is already taken in this poll.` }, { status: 409 });
  const { error } = await auth.svc.from('poll_entries').insert({ poll_id: poll.id, number, name, subtitle: clean(b.subtitle, 120) });
  if (error) return NextResponse.json({ error: 'Couldn’t add that entry.' }, { status: 500 });
  return NextResponse.json({ entries: await loadEntries(auth.svc, poll.id) }, { status: 201 });
}
