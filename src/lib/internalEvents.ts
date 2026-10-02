import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { isExpected } from '@/lib/meetingAudience';
import { loadGroups, withExtras } from '@/lib/meetings';
import type { Capability } from '@/types/database';

export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export interface InternalEventRow {
  id: string; title: string; event_date: string; starts_at: string; ends_at: string; location: string | null; description: string | null;
  audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; cancelled: boolean; created_by: string | null;
}

export async function authorizeInternalEvents(capability: Extract<Capability, 'view_internal_events' | 'host_internal_events'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = roles ?? [];
  if (!hasCapability(grants, capability)) {
    return { error: NextResponse.json({ error: capability === 'host_internal_events' ? 'Only leads, exec and admins can plan internal events.' : 'Internal events are for the team.' }, { status: 403 }) };
  }
  return { user, roles: grants, svc: createServiceClient(), manageAll: hasCapability(grants, 'manage_internal_events') };
}
type Host = { user: { id: string }; manageAll: boolean };
export const canManageInternalEvent = (auth: Host, createdBy: string | null | undefined) => auth.manageAll || createdBy === auth.user.id;
export const notYourInternalEvent = () => NextResponse.json({ error: 'That event was planned by someone else. Only its host, exec and admins can change it.' }, { status: 403 });

export interface InternalEventItem {
  id: string; title: string; date: string; starts_at: string; ends_at: string; location: string | null; description: string | null;
  audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; groupNames: string[];
  host_id: string | null; host_name: string | null; hosting: boolean; canManage: boolean;
  mine: RsvpStatus | null; counts: Record<RsvpStatus, number>; going: string[]; invited: number;
}

// Internal events for a person. `mode: 'invited'` = the ones meant for them (or planned by them); `'manage'` = the ones they can
// edit (their own, or every one for exec/admin). Upcoming only (today onward), soonest first.
export async function listInternalEvents(svc: SupabaseClient, user: { id: string; roles: { role: string }[] }, manageAll: boolean, mode: 'invited' | 'manage'): Promise<InternalEventItem[]> {
  const today = pacificDayKey();
  const { data } = await svc.from('internal_events').select('*').gte('event_date', today).eq('cancelled', false).order('starts_at').limit(200);
  const groups = await loadGroups(svc);
  const rows = ((data ?? []) as InternalEventRow[]).filter((r) => {
    if (mode === 'manage') return manageAll || r.created_by === user.id;
    const [x] = withExtras([{ invitees: r.invitees, group_ids: r.group_ids }], groups);
    return r.created_by === user.id || isExpected({ audience: r.audience, invitees: r.invitees, group_ids: r.group_ids, extra_ids: x.extra_ids }, user.id, user.roles);
  });
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: rsvps } = await svc.from('internal_event_rsvps').select('event_id, user_id, status').in('event_id', ids);
  const people = [...new Set([...(rsvps ?? []).map((r) => r.user_id as string), ...rows.map((r) => r.created_by).filter((x): x is string => !!x)])];
  const { data: profiles } = people.length ? await svc.from('profiles').select('id, display_name').in('id', people) : { data: [] as { id: string; display_name: string | null }[] };
  const name = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
  return rows.map((r) => {
    const mine = (rsvps ?? []).find((x) => x.event_id === r.id && x.user_id === user.id);
    const here = (rsvps ?? []).filter((x) => x.event_id === r.id);
    const counts: Record<RsvpStatus, number> = { going: 0, maybe: 0, not_going: 0 };
    for (const x of here) counts[x.status as RsvpStatus]++;
    const [ex] = withExtras([{ invitees: r.invitees, group_ids: r.group_ids }], groups);
    return {
      id: r.id, title: r.title, date: r.event_date, starts_at: r.starts_at, ends_at: r.ends_at, location: r.location, description: r.description,
      audience: r.audience, invitees: r.invitees, group_ids: r.group_ids, groupNames: (r.group_ids ?? []).map((g) => groups.get(g)?.name).filter((n): n is string => !!n),
      host_id: r.created_by, host_name: r.created_by ? name.get(r.created_by) ?? null : null, hosting: r.created_by === user.id, canManage: manageAll || r.created_by === user.id,
      mine: (mine?.status as RsvpStatus | undefined) ?? null, counts,
      going: here.filter((x) => x.status === 'going').map((x) => name.get(x.user_id as string) ?? 'Unnamed').slice(0, 40),
      invited: ex.extra_ids.length,
    };
  });
}
