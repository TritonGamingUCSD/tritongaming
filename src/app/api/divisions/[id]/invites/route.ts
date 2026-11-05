import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canActInDivision } from '@/lib/portal/divisionAccess';

export const dynamic = 'force-dynamic';

export interface DivisionInvite {
  event_id: string;
  title: string;
  start_date: string;
  /** Who invited: the owner of the event. */
  host: string;
}

// Invitations to co-host an event that are waiting for this division's answer. For its Heads, and exec and admin.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!canActInDivision(mine ?? [], id, 'head')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const svc = createServiceClient();
  const { data: rows } = await svc.from('event_cohosts').select('event_id').eq('division_id', id).eq('status', 'invited');
  const ids = (rows ?? []).map((r) => r.event_id as string);
  if (!ids.length) return NextResponse.json({ invites: [] });
  const [{ data: events }, { data: divisions }] = await Promise.all([
    svc.from('events').select('id, title, start_date, division_id').in('id', ids),
    svc.from('divisions').select('id, name'),
  ]);
  const name = new Map((divisions ?? []).map((d) => [d.id as string, d.name as string]));
  const invites: DivisionInvite[] = (events ?? []).map((e) => ({
    event_id: e.id as string,
    title: e.title as string,
    start_date: e.start_date as string,
    host: e.division_id ? (name.get(e.division_id as string) ?? 'A division') : 'Triton Gaming',
  }));
  return NextResponse.json({ invites });
}
