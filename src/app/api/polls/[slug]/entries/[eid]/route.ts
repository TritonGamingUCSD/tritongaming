import { NextResponse } from 'next/server';
import { removeUnreferencedFiles } from '@/lib/storage/removeFiles';
import { UUID, authorizePolls, loadEntries, loadPoll } from '@/lib/polls/server';

export const dynamic = 'force-dynamic';

const clean = (v: unknown, max: number) =>
  typeof v === 'string'
    ? v
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max)
    : '';

async function find(slug: string, eid: string) {
  const auth = await authorizePolls('host');
  if (auth.error) return { error: auth.error } as const;
  const poll = await loadPoll(auth.svc, slug);
  if (!poll) return { error: NextResponse.json({ error: 'That poll is gone.' }, { status: 404 }) } as const;
  if (!UUID.test(eid)) return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) } as const;
  const { data: entry } = await auth.svc.from('poll_entries').select('id, number, name, subtitle, image').eq('id', eid).eq('poll_id', poll.id).maybeSingle();
  if (!entry) return { error: NextResponse.json({ error: 'That entry is gone.' }, { status: 404 }) } as const;
  return { auth, poll, entry } as const;
}

// Change an entry's name, line or number (officers and above; until the results are shown).
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; eid: string }> }) {
  const { slug, eid } = await params;
  const f = await find(slug, eid);
  if ('error' in f) return f.error;
  if (f.poll.status === 'revealed') return NextResponse.json({ error: 'The results are already shown.' }, { status: 409 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (b.name !== undefined) {
    const n = clean(b.name, 80);
    if (!n) return NextResponse.json({ error: 'Give the entry a name.' }, { status: 400 });
    patch.name = n;
  }
  if (b.subtitle !== undefined) patch.subtitle = clean(b.subtitle, 120);
  if (b.number !== undefined) {
    const n = Math.round(Number(b.number));
    if (!(n >= 1 && n <= 999)) return NextResponse.json({ error: 'A number is 1 to 999.' }, { status: 400 });
    if (n !== f.entry.number) {
      if (f.poll.status !== 'draft') return NextResponse.json({ error: 'Numbers can only change before voting opens.' }, { status: 409 });
      const { count } = await f.auth.svc.from('poll_entries').select('id', { count: 'exact', head: true }).eq('poll_id', f.poll.id).eq('number', n);
      if (count) return NextResponse.json({ error: `Number ${n} is already taken in this poll.` }, { status: 409 });
      patch.number = n;
    }
  }
  if (Object.keys(patch).length) await f.auth.svc.from('poll_entries').update(patch).eq('id', eid);
  return NextResponse.json({ entries: await loadEntries(f.auth.svc, f.poll.id) });
}

// Remove an entry (officers and above), only while the poll is a draft (its votes would go with it).
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string; eid: string }> }) {
  const { slug, eid } = await params;
  const f = await find(slug, eid);
  if ('error' in f) return f.error;
  if (f.poll.status !== 'draft') return NextResponse.json({ error: 'Entries can only be removed before voting opens.' }, { status: 409 });
  await f.auth.svc.from('poll_entries').delete().eq('id', eid);
  await removeUnreferencedFiles(f.auth.svc, [f.entry.image as string]);
  return NextResponse.json({ entries: await loadEntries(f.auth.svc, f.poll.id) });
}
