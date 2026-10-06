import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/checkinDays';
import { createNotifications, type NotificationInput } from '@/lib/notify';
import { getExpectedPeople } from '@/lib/meetings';
import { PLAN_HREF, type PlanRow } from '@/lib/meetingPlanServer';
import { formatPacificDateTime } from '@/lib/timezone';
import { WEEKDAYS, clockLabel, planDayKeys } from '@/lib/meetingPlans';

interface Spec { title: string; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; created_by: string | null }

// Someone was added to a saved group. Groups are live, so they are now asked to everything that group was chosen for: upcoming
// meetings, weekly meetings, internal events, and meeting plans still collecting availability. Each person is told about each of
// those, unless they were already expected another way (their role, being added directly, another group), and never about
// something they host. Returns how many notifications were sent.
export async function notifyGroupAdditions(svc: SupabaseClient, groupId: string, before: string[], after: string[]): Promise<number> {
  const old = new Set(before);
  const added = after.filter((id) => !old.has(id));
  if (added.length === 0) return 0;
  const today = pacificDayKey();

  const [{ data: meetings }, { data: series }, { data: events }, { data: plans }] = await Promise.all([
    svc.from('meetings').select('id, title, starts_at, location, audience, invitees, group_ids, created_by').contains('group_ids', [groupId]).gte('meeting_date', today).eq('cancelled', false).is('series_id', null),
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, audience, invitees, group_ids, created_by').contains('group_ids', [groupId]).eq('active', true),
    svc.from('internal_events').select('id, title, starts_at, location, audience, invitees, group_ids, created_by').contains('group_ids', [groupId]).gte('event_date', today).eq('cancelled', false),
    svc.from('meeting_plans').select('*').contains('group_ids', [groupId]).eq('status', 'open'),
  ]);

  // Who among the newly added people wasn't already expected without this group.
  const fresh = async (s: Spec) => {
    const without = await getExpectedPeople(svc, { audience: s.audience, invitees: s.invitees, group_ids: (s.group_ids ?? []).filter((g) => g !== groupId) });
    const had = new Set(without.map((p) => p.id));
    return added.filter((id) => !had.has(id) && id !== s.created_by);
  };

  const rows: NotificationInput[] = [];
  for (const m of (meetings ?? []) as (Spec & { starts_at: string; location: string | null })[]) {
    for (const id of await fresh(m)) rows.push({ user_id: id, type: 'meeting_invite', title: `You’re invited to ${m.title}`, body: `${formatPacificDateTime(new Date(m.starts_at), { weekday: true })}${m.location ? ` · ${m.location}` : ''}`, href: '/portal/meetings/mine' });
  }
  for (const s of (series ?? []) as (Spec & { weekday: number; start_time: string; end_time: string; location: string | null })[]) {
    for (const id of await fresh(s)) rows.push({ user_id: id, type: 'meeting_invite', title: `You’re invited to ${s.title}`, body: `Every ${WEEKDAYS[s.weekday]}, ${clockLabel(s.start_time)} to ${clockLabel(s.end_time)}${s.location ? ` · ${s.location}` : ''}`, href: '/portal/meetings/mine' });
  }
  for (const e of (events ?? []) as (Spec & { starts_at: string; location: string | null })[]) {
    for (const id of await fresh(e)) rows.push({ user_id: id, type: 'internal_event_invite', title: `You’re invited to ${e.title}`, body: `${formatPacificDateTime(new Date(e.starts_at), { weekday: true })}${e.location ? ` · ${e.location}` : ''}`, href: '/portal/internal-events' });
  }
  for (const p of (plans ?? []) as PlanRow[]) {
    if (planDayKeys(p, today).length === 0) continue;   // every day has passed; nothing to fill out
    for (const id of await fresh(p)) rows.push({ user_id: id, type: 'meeting_invite', title: `When can you meet? ${p.title}`, body: `${p.answer_by ? `Please answer by ${new Date(`${p.answer_by}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}. ` : ''}Mark the times you can make it.`, href: PLAN_HREF(p.id) });
  }
  return createNotifications(svc, rows);
}
