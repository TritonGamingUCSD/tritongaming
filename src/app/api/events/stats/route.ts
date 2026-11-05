import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { getEventSummary, type EventSummary } from '@/lib/events/eventSummary';

export const dynamic = 'force-dynamic';

export interface EventStatsRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  audience: string | null;
  ticket_price: number | null;
  s: EventSummary;
}

// The numbers of every past event side by side, for the Analytics table (the same numbers the per-event report uses, one row per event). Aggregates only, for people who can open the event reports.
// Each event reads its own tickets and profiles, so only the latest N events load (default 24, at most 60), a few at a time, and the answer is kept for five minutes.
const cache = new Map<number, { at: number; rows: EventStatsRow[] }>();
export async function GET(req: Request) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!hasCapability(grants, 'checkin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(60, Math.max(1, Math.round(Number(new URL(req.url).searchParams.get('limit')) || 24)));
  const hit = cache.get(limit);
  if (hit && Date.now() - hit.at < 5 * 60_000) return NextResponse.json({ rows: hit.rows });

  const { data: events } = await svc
    .from('events')
    .select('id, title, start_date, end_date, audience, ticket_price, requires_checkin_form')
    .lte('start_date', new Date().toISOString())
    .order('start_date', { ascending: false })
    .limit(limit);
  const list = events ?? [];
  const rows: EventStatsRow[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        const e = list[i];
        const s = await getEventSummary(e.id as string, {
          start_date: e.start_date as string,
          end_date: e.end_date as string | null,
          requires_checkin_form: !!e.requires_checkin_form,
          ticket_price: e.ticket_price as number | null,
          audience: e.audience as string | null,
        });
        rows[i] = {
          id: e.id as string,
          title: e.title as string,
          start_date: e.start_date as string,
          end_date: (e.end_date as string | null) ?? null,
          audience: (e.audience as string | null) ?? null,
          ticket_price: (e.ticket_price as number | null) ?? null,
          s,
        };
      }
    }),
  );
  cache.set(limit, { at: Date.now(), rows });
  return NextResponse.json({ rows });
}
