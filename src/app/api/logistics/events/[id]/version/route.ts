import { NextResponse } from 'next/server';
import { namesOf } from '@/lib/docs/docsServer';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';

// A tiny "has anything changed?" check for the event-day screen (small reads, no plan data). It answers with the plan's change stamp (bumped by anything that changes the plan's
// makeup: devices, stations, swaps, status), how many steps are done in all, the steps done since the time the phone last heard about (?since=) and the prize counts changed since
// ?prize_since=. Prize counts are not a change of the plan's makeup, so they never bump the stamp (that would make every phone download the whole plan for each count). A phone applies
// those itself and only downloads the whole plan again if the stamp moved or its own count of done steps no longer matches (someone undid one).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const since = new URL(request.url).searchParams.get('since');
  const valid = since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : null;
  const prizeSince = new URL(request.url).searchParams.get('prize_since');
  const prizeValid = prizeSince && !Number.isNaN(Date.parse(prizeSince)) ? new Date(prizeSince).toISOString() : null;
  const [plan, count, changes, prizeChanges] = await Promise.all([
    auth.svc.from('logistics_plans').select('updated_at, status').eq('id', id).maybeSingle(),
    auth.svc.from('logistics_plan_steps').select('device_id', { count: 'exact', head: true }).eq('plan_id', id),
    valid
      ? auth.svc
          .from('logistics_plan_steps')
          .select('device_id, borrowed_id, slot_id, step_id, done_at, done_by')
          .eq('plan_id', id)
          .gt('done_at', valid)
          .order('done_at')
          .limit(300)
      : Promise.resolve({ data: [] as { device_id: string | null; borrowed_id: string | null; slot_id: string | null; step_id: string; done_at: string }[] }),
    prizeValid
      ? auth.svc.from('logistics_plan_prize_steps').select('line_id, step_id, done, updated_at').eq('plan_id', id).gt('updated_at', prizeValid).order('updated_at').limit(300)
      : Promise.resolve({ data: [] as { line_id: string; step_id: string; done: number; updated_at: string }[] }),
  ]);
  if (!plan.data) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  const who = await namesOf(
    auth.svc,
    ((changes.data ?? []) as { done_by?: string | null }[]).map((c) => c.done_by),
  );
  return NextResponse.json({
    updated_at: plan.data.updated_at,
    status: plan.data.status,
    count: count.count ?? 0,
    prize_changes: prizeChanges.data ?? [],
    changes: (changes.data ?? []).map(({ done_by, ...c }: { done_by?: string | null; [k: string]: unknown }) => ({ ...c, by: who.get(done_by as string) ?? null })),
  });
}
