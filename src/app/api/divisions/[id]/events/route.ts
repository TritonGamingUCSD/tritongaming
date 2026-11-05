import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { cleanSelfCheckinMode } from '@/lib/events/selfCheckin';

export const dynamic = 'force-dynamic';

export interface DivisionEventRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  is_published: boolean;
  slug: string | null;
  self_checkin_mode: 'off' | 'until_end' | 'forever';
  registered: number;
  checkedIn: number;
  /** Everyone who hosts it: the owner first. A division has a name and logo; Triton Gaming is `tg: true`. */
  hosts: { tg?: boolean; name: string; logoUrl: string | null }[];
}

// A division's events: the ones it owns and the ones it co-hosts (accepted), newest first, with how many registered and checked in and who hosts each. For its Members and Heads, and exec and admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, 'see_numbers')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: co } = await svc.from('event_cohosts').select('event_id').eq('division_id', id).eq('status', 'accepted');
  const coIds = (co ?? []).map((c) => c.event_id as string);
  let q = svc.from('events').select('id, title, slug, self_checkin_mode, start_date, end_date, is_published, division_id').order('start_date', { ascending: false }).limit(100);
  q = coIds.length ? q.or(`division_id.eq.${id},id.in.(${coIds.join(',')})`) : q.eq('division_id', id);
  const { data: events } = await q;
  const ids = (events ?? []).map((e) => e.id as string);
  if (!ids.length) return NextResponse.json({ events: [] });

  const [{ data: tickets }, { data: cohosts }, { data: divisions }] = await Promise.all([
    svc.from('tickets').select('event_id, status').in('event_id', ids).neq('status', 'cancelled').limit(50000),
    svc.from('event_cohosts').select('event_id, division_id').in('event_id', ids).eq('status', 'accepted'),
    svc.from('divisions').select('id, name, logo_url'),
  ]);
  const count = new Map<string, { registered: number; checkedIn: number }>();
  for (const t of tickets ?? []) {
    const c = count.get(t.event_id as string) ?? { registered: 0, checkedIn: 0 };
    c.registered++;
    if (t.status === 'used') c.checkedIn++;
    count.set(t.event_id as string, c);
  }
  const div = new Map((divisions ?? []).map((d) => [d.id as string, { name: d.name as string, logoUrl: (d.logo_url as string | null) ?? null }]));
  const hostsOf = (eventId: string, owner: string | null) => {
    const out: DivisionEventRow['hosts'] = [owner ? { ...(div.get(owner) ?? { name: 'Division', logoUrl: null }) } : { tg: true, name: 'Triton Gaming', logoUrl: null }];
    for (const c of cohosts ?? []) {
      if (c.event_id !== eventId) continue;
      out.push(c.division_id ? { ...(div.get(c.division_id as string) ?? { name: 'Division', logoUrl: null }) } : { tg: true, name: 'Triton Gaming', logoUrl: null });
    }
    return out;
  };
  const rows: DivisionEventRow[] = (events ?? []).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    start_date: e.start_date as string,
    end_date: (e.end_date as string | null) ?? null,
    is_published: !!e.is_published,
    slug: (e.slug as string | null) ?? null,
    self_checkin_mode: cleanSelfCheckinMode(e.self_checkin_mode as string | null),
    registered: count.get(e.id as string)?.registered ?? 0,
    checkedIn: count.get(e.id as string)?.checkedIn ?? 0,
    hosts: hostsOf(e.id as string, (e.division_id as string | null) ?? null),
  }));
  return NextResponse.json({ events: rows });
}
