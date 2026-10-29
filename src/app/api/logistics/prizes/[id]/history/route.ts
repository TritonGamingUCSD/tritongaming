import { NextResponse } from 'next/server';
import { namesOf } from '@/lib/docs/docsServer';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// The history of one prize (every officer can look): stock added, counts corrected, promised to stations, given out, newest first. Read when a prize's history is opened.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data } = await auth.svc
    .from('logistics_prize_log')
    .select('id, kind, qty, plan_name, station, sponsor_id, note, ref, actor, at')
    .eq('prize_id', id)
    .order('at', { ascending: false })
    .limit(300);
  const sponsorIds = [...new Set((data ?? []).map((e) => e.sponsor_id as string | null).filter((x): x is string => !!x))];
  const [names, { data: sponsors }] = await Promise.all([
    namesOf(
      auth.svc,
      (data ?? []).map((e) => e.actor as string | null),
    ),
    sponsorIds.length ? auth.svc.from('logistics_sponsors').select('id, name').in('id', sponsorIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const sponsor = new Map((sponsors ?? []).map((s) => [s.id as string, s.name as string]));
  return NextResponse.json({
    log: (data ?? []).map(({ actor, sponsor_id, ...e }) => ({
      ...e,
      by: names.get(actor as string) ?? null,
      sponsor: sponsor_id ? (sponsor.get(sponsor_id as string) ?? null) : null,
    })),
  });
}
