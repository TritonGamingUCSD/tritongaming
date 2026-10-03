import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/capabilities';
import { loadGrantedCapabilities } from '@/lib/grantedCapabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { createNotifications } from '@/lib/notify';
import { staffName } from '@/lib/names';
import { formatPacificDateTime } from '@/lib/timezone';
import { getExpectedPeople, loadGroups, occurrenceTimes, weekdayOfKey, type PersonRow } from '@/lib/meetings';
import { collectCalendarItems } from '@/lib/calendarItems';
import { addDays } from '@/lib/meetingPlans';
import type { BusyBlock } from '@/lib/meetingPlans';
import { AUTO_ABSENT_REASON, MAX_RANGE_DAYS, hasAnySlot, SLOT_MIN, availabilityFor, canStartAt, clockLabel, daysBetween, planDayKeys, slotStarts, toHhmm, toMin, WEEKDAYS, type PlanSlots, type PlanView, type Person } from '@/lib/meetingPlans';

export interface PlanRow {
  id: string; kind: 'once' | 'weekly'; title: string; description: string | null; location: string | null; duration_min: number;
  window_start: string; window_end: string; range_start: string | null; range_end: string | null; answer_by: string | null;
  audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; status: 'open' | 'decided';
  meeting_id: string | null; series_id: string | null; decided_slot: PlanView['decided_slot']; created_by: string | null; created_at: string; reminded_at: string | null; nudged_at: string | null;
}

export const PLAN_HREF = (id: string) => `/portal?section=meetings&tab=planning&plan=${id}`;

type Auth = { user: { id: string }; svc: SupabaseClient; manageAll: boolean; canHost: boolean; roles?: { role: string; division_id?: string | null }[] };

// Any signed-in person may open the Planning tab (they only see plans they were asked about); creating and running a plan is for
// whoever can plan meetings (lead, exec, admin), and a lead only manages their own plans.
export async function authorizePlans(): Promise<{ error: NextResponse } | (Auth & { roles: { role: string }[] })> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const svc = createServiceClient();
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  return { user, svc, roles: grants, canHost: hasCapability(grants, 'host_meetings'), manageAll: hasCapability(grants, 'manage_meetings') };
}

// Everyone asked to answer: the audience, plus the host (who also fills in their own time).
export async function planPeople(svc: SupabaseClient, plan: PlanRow): Promise<{ expected: PersonRow[]; people: Person[] }> {
  const expected = await getExpectedPeople(svc, { audience: plan.audience, invitees: plan.invitees, group_ids: plan.group_ids });
  const people: Person[] = expected.map((p) => ({ id: p.id, name: p.name }));
  if (plan.created_by && !people.some((p) => p.id === plan.created_by)) {
    const { data } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name').eq('id', plan.created_by).maybeSingle();
    if (data) people.push({ id: data.id as string, name: staffName(data) });
  }
  return { expected, people: people.sort((a, b) => a.name.localeCompare(b.name)) };
}

// Who has really answered: at least one available or if-needed slot on the plan's grid as it is now.
export async function answeredUserIds(svc: SupabaseClient, plan: PlanRow): Promise<Set<string>> {
  const { data } = await svc.from('meeting_plan_responses').select('user_id, slots').eq('plan_id', plan.id);
  const days = planDayKeys(plan, pacificDayKey());
  const starts = slotStarts(plan.window_start, plan.window_end);
  return new Set((data ?? []).filter((r) => hasAnySlot(r.slots as PlanSlots, days, starts)).map((r) => r.user_id as string));
}

// The plans this person can see (they were asked to answer, they host it, or they can manage every meeting), as the UI needs them.
export async function loadPlanViews(auth: Auth, only?: string): Promise<PlanView[]> {
  const { svc } = auth;
  const today = pacificDayKey();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let q = svc.from('meeting_plans').select('*').order('created_at', { ascending: false });
  if (only) q = q.eq('id', only); else q = q.or(`status.eq.open,created_at.gte.${weekAgo}`);
  const { data } = await q;
  const plans = (data ?? []) as PlanRow[];
  if (plans.length === 0) return [];
  const [{ data: resp }, groups] = await Promise.all([
    svc.from('meeting_plan_responses').select('plan_id, user_id, slots, busy').in('plan_id', plans.map((p) => p.id)),
    loadGroups(svc),
  ]);
  const hostIds = [...new Set(plans.map((p) => p.created_by).filter((x): x is string => !!x))];
  const { data: hosts } = hostIds.length ? await svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', hostIds) : { data: [] as { id: string; display_name: string | null }[] };
  const hostName = new Map((hosts ?? []).map((h) => [h.id as string, staffName(h as never)]));
  const views: PlanView[] = [];
  for (const plan of plans) {
    const isHost = plan.created_by === auth.user.id;
    const { people } = await planPeople(svc, plan);
    const mineAsked = people.some((p) => p.id === auth.user.id);
    if (!isHost && !mineAsked && !auth.manageAll) continue;
    const days = planDayKeys(plan, today);
    const starts = new Set(slotStarts(plan.window_start, plan.window_end));
    const responses: Record<string, PlanSlots> = {};
    const blockedByUser: Record<string, BusyBlock[]> = {};
    for (const r of (resp ?? []).filter((x) => x.plan_id === plan.id)) {
      // Only what the grid currently shows (answers for removed days or hours stay stored and come back if they return).
      const slots: PlanSlots = {};
      for (const d of days) {
        const row = (r.slots as PlanSlots)?.[d];
        if (!row) continue;
        const keep = Object.fromEntries(Object.entries(row).filter(([t]) => starts.has(t))) as PlanSlots[string];
        if (Object.keys(keep).length) slots[d] = keep;
      }
      // An empty grid isn't an answer yet: they still have it to do.
      if (Object.keys(slots).length > 0) responses[r.user_id as string] = slots;
      if (isHost || auth.manageAll) blockedByUser[r.user_id as string] = ((r.busy as BusyBlock[] | null) ?? []).filter((b) => (plan.kind === 'weekly' ? true : days.includes(b.day)));
    }
    views.push({
      id: plan.id, kind: plan.kind, title: plan.title, description: plan.description, location: plan.location, duration_min: plan.duration_min,
      window_start: plan.window_start.slice(0, 5), window_end: plan.window_end.slice(0, 5), range_start: plan.range_start, range_end: plan.range_end, answer_by: plan.answer_by,
      status: plan.status, decided_slot: plan.decided_slot, meeting_id: plan.meeting_id, series_id: plan.series_id,
      host_id: plan.created_by, host_name: hostName.get(plan.created_by ?? '') ?? null,
      days, expired: plan.kind === 'once' && days.length === 0, people, responses, mine: responses[auth.user.id] ?? null,
      isHost, canManage: isHost || auth.manageAll, audience: plan.audience, invitees: plan.invitees, group_ids: plan.group_ids,
      groupNames: (plan.group_ids ?? []).map((g) => groups.get(g)?.name).filter((n): n is string => !!n),
      canReopen: false,
      busy: [],
      blocked: blockedByUser,
    });
  }
  // What is already on my calendar for each plan I'm asked to answer.
  for (const v of views.filter((x) => x.status === 'open' && !x.expired && x.people.some((p) => p.id === auth.user.id))) v.busy = await busyBlocksFor(svc, auth.user, auth.roles ?? [], v, v.days);
  // Whether each decided plan can still be taken back (the meeting hasn't started or opened).
  for (const v of views.filter((x) => x.status === 'decided' && x.canManage)) v.canReopen = await canReopenPlan(svc, v);
  return views;
}

async function canReopenPlan(svc: SupabaseClient, v: Pick<PlanView, 'meeting_id' | 'series_id'>): Promise<boolean> {
  if (v.meeting_id) {
    const { data } = await svc.from('meetings').select('opened_at, starts_at').eq('id', v.meeting_id).maybeSingle();
    if (!data) return true;
    const { count } = await svc.from('meeting_attendance').select('user_id', { count: 'exact', head: true }).eq('meeting_id', v.meeting_id);
    return !data.opened_at && !(count ?? 0) && new Date(data.starts_at as string).getTime() > Date.now();
  }
  if (v.series_id) {
    const { data } = await svc.from('meetings').select('id, opened_at').eq('series_id', v.series_id);
    const opened = (data ?? []).filter((m) => m.opened_at).map((m) => m.id as string);
    if (opened.length) return false;
    const ids = (data ?? []).map((m) => m.id as string);
    if (!ids.length) return true;
    const { count } = await svc.from('meeting_attendance').select('user_id', { count: 'exact', head: true }).in('meeting_id', ids);
    return !(count ?? 0);
  }
  return true;
}

// What is already on this person's Triton Gaming calendar during the plan: meetings meant for them or hosted by them, internal events
// they're going to, events they have a ticket for. They can't be available then. A weekly plan uses the weekly meetings they attend.
export async function busyBlocksFor(svc: SupabaseClient, user: { id: string }, roles: { role: string; division_id?: string | null }[], plan: Pick<PlanRow, 'kind' | 'range_start' | 'range_end'>, days: string[]): Promise<BusyBlock[]> {
  const today = pacificDayKey();
  const from = plan.kind === 'weekly' ? today : days[0];
  const to = plan.kind === 'weekly' ? addDays(today, 6) : days[days.length - 1];
  if (!from || !to) return [];
  const items = await collectCalendarItems(svc, user, roles as never, from, to).catch(() => []);
  const dayKeys = new Set(days);
  const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  const out: BusyBlock[] = [];
  for (const it of items) {
    // Only what is really theirs: meetings for them, internal events they're going to, events they have a ticket for.
    if (it.kind !== 'meeting' && !it.mine) continue;
    if (plan.kind === 'weekly' && !it.repeats) continue;
    const key = plan.kind === 'weekly' ? String(weekdayOfKey(it.date)) : it.date;
    if (plan.kind === 'once' && !dayKeys.has(key)) continue;
    const startDay = pacificDayKey(new Date(it.start));
    const endIso = it.end ?? new Date(new Date(it.start).getTime() + 3600_000).toISOString();
    const endDay = pacificDayKey(new Date(endIso));
    // A multi-day event takes its whole day on the days in between; on its first and last day only the hours it runs.
    const start = it.date === startDay ? clock(it.start) : '00:00';
    const end = it.date === endDay ? clock(endIso) : '23:59';
    const why = it.kind === 'meeting' ? (it.mine ? 'You’re hosting this meeting' : 'You’re invited to this meeting') : it.kind === 'internal' ? 'You said you’re going' : 'You have a ticket';
    if (end > start || it.date !== endDay) out.push({ day: key, start, end: end > start ? end : '23:59', title: it.title, why });
  }
  return out;
}

const whenLabel = (plan: Pick<PlanRow, 'kind'>, slot: { day?: string; weekday?: number; start: string }, endHhmm: string) =>
  plan.kind === 'weekly' ? `Every ${WEEKDAYS[slot.weekday ?? 0]}, ${clockLabel(slot.start)} to ${clockLabel(endHhmm)}`
    : `${formatPacificDateTime(occurrenceTimes(slot.day!, slot.start, endHhmm).starts, { weekday: true })} to ${clockLabel(endHhmm)}`;

// Ask people to fill in their availability (or tell them the plan's dates changed). The host is never notified of their own plan.
export async function notifyPlanAsk(svc: SupabaseClient, plan: PlanRow, opts: { kind: 'new' | 'dates' | 'nudge' | 'reminder'; onlyUsers?: string[]; skip?: Set<string> }): Promise<number> {
  const { people } = await planPeople(svc, plan);
  const rows = people
    .filter((p) => p.id !== plan.created_by && !opts.skip?.has(p.id) && (!opts.onlyUsers || opts.onlyUsers.includes(p.id)))
    .map((p) => ({
      user_id: p.id, type: 'meeting_invite',
      title: opts.kind === 'new' ? `When can you meet? ${plan.title}` : opts.kind === 'dates' ? `${plan.title}: the dates changed` : `Add your availability for ${plan.title}`,
      body: `${plan.answer_by ? `Please answer by ${new Date(`${plan.answer_by}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })}. ` : ''}Mark the times you can make it.`,
      href: PLAN_HREF(plan.id),
    }));
  return createNotifications(svc, rows);
}

// Reminds people who haven't answered, once, a day after the plan was made. Run from the daily cron.
export async function sendPlanReminders(svc: SupabaseClient, now: Date = new Date(), onlyUsers?: string[]): Promise<{ plans: number; sent: number }> {
  const { data } = await svc.from('meeting_plans').select('*').eq('status', 'open').is('reminded_at', null).lte('created_at', new Date(now.getTime() - 24 * 3600_000).toISOString());
  let sent = 0, counted = 0;
  const today = pacificDayKey(now);
  for (const plan of (data ?? []) as PlanRow[]) {
    if (planDayKeys(plan, today).length === 0) continue;
    counted++;
    sent += await notifyPlanAsk(svc, plan, { kind: 'reminder', skip: await answeredUserIds(svc, plan), onlyUsers });
    await svc.from('meeting_plans').update({ reminded_at: now.toISOString() }).eq('id', plan.id);
  }
  return { plans: counted, sent };
}

export type DecideResult = { ok: true; meeting_id: string | null; series_id: string | null; absent: string[] } | { ok: false; error: string; status: number };

// The host picks the time: the plan becomes a real meeting (or weekly series), people who marked it unavailable are marked absent
// (excused, with a reason), and everyone is told.
export async function decidePlan(svc: SupabaseClient, plan: PlanRow, pick: { day?: string; weekday?: number; start: string }, hostId: string): Promise<DecideResult> {
  if (plan.status !== 'open') return { ok: false, error: 'A time was already picked for this plan.', status: 409 };
  const today = pacificDayKey();
  const shape = { duration_min: plan.duration_min, window_start: plan.window_start, window_end: plan.window_end };
  if (!/^\d{2}:\d{2}$/.test(pick.start) || !canStartAt(shape, pick.start)) return { ok: false, error: 'That start time doesn’t fit the plan.', status: 400 };
  const end = toHhmm(toMin(pick.start) + plan.duration_min);
  const dayKey = plan.kind === 'weekly' ? String(pick.weekday) : String(pick.day);
  if (!planDayKeys(plan, today).includes(dayKey)) return { ok: false, error: plan.kind === 'weekly' ? 'Pick a day of the week.' : 'Pick one of the plan’s days (days that have passed are gone).', status: 400 };

  const { expected } = await planPeople(svc, plan);
  const { data: resp } = await svc.from('meeting_plan_responses').select('user_id, slots').eq('plan_id', plan.id);
  const done = await answeredUserIds(svc, plan);
  const byUser = new Map((resp ?? []).filter((r) => done.has(r.user_id as string)).map((r) => [r.user_id as string, r.slots as PlanSlots]));
  // Who can't make it: people who answered and are unavailable, plus anyone (answered or not) with something already on their
  // Triton Gaming calendar then. The calendar item is named in the reason, so they know why.
  const startMin = toMin(pick.start), endMin = startMin + plan.duration_min;
  const conflicts = new Map<string, string[]>();
  const others = expected.filter((p) => p.id !== hostId);
  for (let i = 0; i < others.length; i += 8) {
    await Promise.all(others.slice(i, i + 8).map(async (p) => {
      const { data: rl } = await svc.from('user_roles').select('role, division_id').eq('user_id', p.id);
      const blocks = await busyBlocksFor(svc, { id: p.id }, rl ?? [], plan, planDayKeys(plan, today));
      const titles = [...new Set(blocks.filter((b) => b.day === dayKey && toMin(b.start) < endMin && toMin(b.end) > startMin).map((b) => b.title))];
      if (titles.length) conflicts.set(p.id, titles);
    }));
  }
  const unavailable = others.filter((p) => conflicts.has(p.id) || (byUser.has(p.id) && availabilityFor(byUser.get(p.id), dayKey, pick.start, plan.duration_min) === 'unavailable'));
  const reasonFor = (id: string) => conflicts.has(id) ? `${AUTO_ABSENT_REASON} (already booked: ${conflicts.get(id)!.join(', ')})`.slice(0, 140) : AUTO_ABSENT_REASON;
  const common = { title: plan.title, location: plan.location, description: plan.description, audience: plan.audience, invitees: plan.invitees, group_ids: plan.group_ids, created_by: plan.created_by };

  let meetingId: string | null = null, seriesId: string | null = null;
  if (plan.kind === 'once') {
    const { starts, ends } = occurrenceTimes(String(pick.day), pick.start, end);
    const { data, error } = await svc.from('meetings').insert({ ...common, meeting_date: pick.day, starts_at: starts.toISOString(), ends_at: ends.toISOString() }).select('id').single();
    if (error || !data) return { ok: false, error: 'Couldn’t schedule the meeting.', status: 500 };
    meetingId = data.id as string;
    if (unavailable.length) await svc.from('meeting_absences').upsert(unavailable.map((p) => ({ meeting_id: meetingId, user_id: p.id, reason: reasonFor(p.id), excused: true, marked_by: hostId, plan_id: plan.id })), { onConflict: 'meeting_id,user_id' });
  } else {
    const { data, error } = await svc.from('meeting_series').insert({ ...common, weekday: pick.weekday, start_time: pick.start, end_time: end }).select('id').single();
    if (error || !data) return { ok: false, error: 'Couldn’t schedule the weekly meeting.', status: 500 };
    seriesId = data.id as string;
    if (unavailable.length) await svc.from('meeting_series_absences').upsert(unavailable.map((p) => ({ series_id: seriesId, user_id: p.id, reason: reasonFor(p.id), excused: true, plan_id: plan.id })), { onConflict: 'series_id,user_id' });
  }
  await svc.from('meeting_plans').update({ status: 'decided', meeting_id: meetingId, series_id: seriesId, decided_slot: plan.kind === 'weekly' ? { weekday: pick.weekday, start: pick.start } : { day: pick.day, start: pick.start } }).eq('id', plan.id);

  const when = whenLabel(plan, pick, end) + (plan.location ? ` · ${plan.location}` : '');
  const out = new Set(unavailable.map((p) => p.id));
  await createNotifications(svc, expected.filter((p) => p.id !== hostId).map((p) => ({
    user_id: p.id, type: 'meeting_invite',
    title: out.has(p.id) ? `${plan.title} is set, and you’re marked absent` : `${plan.title} is set`,
    body: out.has(p.id) ? `${when}. ${conflicts.has(p.id) ? `You already have ${conflicts.get(p.id)!.join(', ')} then` : 'You said you’re not available then'}, so you’re marked absent (excused).` : when,
    href: '/portal?section=meetings&tab=mine',
  })));
  return { ok: true, meeting_id: meetingId, series_id: seriesId, absent: unavailable.map((p) => p.name) };
}

// Take the decision back: removes the meeting (or weekly series) it created and the absences it made, and reopens answering.
export async function reopenPlan(svc: SupabaseClient, plan: PlanRow): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (plan.status !== 'decided') return { ok: false, error: 'This plan is still open.', status: 409 };
  if (!(await canReopenPlan(svc, plan))) return { ok: false, error: 'The meeting has already started, so planning can’t be reopened.', status: 409 };
  if (plan.meeting_id) await svc.from('meetings').delete().eq('id', plan.meeting_id);
  if (plan.series_id) {
    await svc.from('meetings').delete().eq('series_id', plan.series_id);
    await svc.from('meeting_series').delete().eq('id', plan.series_id);
  }
  await svc.from('meeting_plans').update({ status: 'open', meeting_id: null, series_id: null, decided_slot: null }).eq('id', plan.id);
  return { ok: true };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Fields shared by creating and editing a plan. Returns the cleaned values or an error message.
export function readPlanFields(b: Record<string, unknown>, kind: 'once' | 'weekly'): { ok: true; v: Record<string, unknown> } | { ok: false; error: string } {
  const title = String(b.title ?? '').trim().slice(0, 60);
  if (!title) return { ok: false, error: 'Give the plan a name.' };
  const duration = Number(b.duration_min);
  if (!Number.isInteger(duration) || duration < SLOT_MIN || duration > 480 || duration % SLOT_MIN !== 0) return { ok: false, error: 'Pick a meeting length (30 minutes to 8 hours).' };
  const ws = String(b.window_start ?? '').slice(0, 5), we = String(b.window_end ?? '').slice(0, 5);
  if (!TIME.test(ws) || !TIME.test(we) || toMin(ws) % SLOT_MIN || toMin(we) % SLOT_MIN || toMin(we) - toMin(ws) < duration) return { ok: false, error: 'Pick the earliest and latest time to show (on the hour or half hour), with room for the meeting length.' };
  const answerBy = b.answer_by ? String(b.answer_by) : null;
  if (answerBy && !DATE.test(answerBy)) return { ok: false, error: 'That answer-by date isn’t valid.' };
  const v: Record<string, unknown> = {
    title, duration_min: duration, window_start: ws, window_end: we, answer_by: answerBy,
    description: String(b.description ?? '').trim().slice(0, 500) || null, location: String(b.location ?? '').trim().slice(0, 80) || null,
  };
  if (kind === 'once') {
    const rs = String(b.range_start ?? ''), re = String(b.range_end ?? '');
    if (!DATE.test(rs) || !DATE.test(re) || re < rs) return { ok: false, error: 'Pick the first and last day to choose from.' };
    if (daysBetween(rs, re) > MAX_RANGE_DAYS - 1) return { ok: false, error: `Plans can span at most ${MAX_RANGE_DAYS} days.` };
    if (re < pacificDayKey()) return { ok: false, error: 'Pick days that haven’t passed.' };
    v.range_start = rs; v.range_end = re;
  }
  return { ok: true, v };
}

