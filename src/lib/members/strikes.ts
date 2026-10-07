import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { attachExtras } from '@/lib/meetings/meetings';
import { isExpectedActive } from '@/lib/meetings/meetingAudience';
import { inactiveIds } from '@/lib/members/quarters';
import { createNotifications } from '@/lib/notifications/notify';
import { logAudit } from '@/lib/notifications/audit';
import { staffName } from '@/lib/members/names';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { STRIKE_LIMIT, STRIKES_AT_LIMIT, markLabels } from '@/lib/members/strikeLabels';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';

// The strike tracker. Private: a person sees only their own, and only exec, HR (the "manage strikes" permission, handed out in Admin → Access) and
// admins see everyone's. They add strikes directly (no approval); leads can only send them a request. Every action carries a reason that the
// person can read (never who did it). Nothing happens automatically except a voucher being used when a strike is added.
// Every query goes through the service role behind a check made here: there is no other way to read these tables.

export { STRIKE_LIMIT, STRIKES_AT_LIMIT };
export const STRIKE_CATEGORIES = [
  { id: 'meeting', label: 'Missed meeting' },
  { id: 'event_shift', label: 'Missed event shift' },
  { id: 'deadline', label: 'Missed deadline or task' },
  { id: 'conduct', label: 'Conduct' },
  { id: 'other', label: 'Other' },
] as const;
export type StrikeCategory = (typeof STRIKE_CATEGORIES)[number]['id'];
export const cleanCategory = (v: unknown): StrikeCategory => (STRIKE_CATEGORIES.some((c) => c.id === v) ? (v as StrikeCategory) : 'other');
// A missed meeting shows up as soon as the meeting ends. (Anyone can still be excused afterwards, which moves it out of the list.)
export const EXCUSE_WINDOW_MS = 0;
// Strikes are tracked for officers, leads and exec (not recruits or alumni).
export const TRACKED_ROLES = ['officer', 'lead', 'exec'] as const;
// Publishing a strike that takes someone to the limit (not one that merely adds to a person already there).
export const crossesLimit = (before: number, after: number) => before < STRIKE_LIMIT && after >= STRIKE_LIMIT;
// Automated tests send this header so the alerts to HR and admins are skipped (they would reach real people). It is ignored in production.
export const quietTest = (req: Request) => process.env.NODE_ENV !== 'production' && req.headers.get('x-strikes-test') === '1';
export const isTracked = (roles: { role: string }[]) => roles.some((r) => (TRACKED_ROLES as readonly string[]).includes(r.role));

// 'manage' = exec / HR / admin; 'self' = anyone tracked (officer, lead, exec).
export async function authorizeStrikes(mode: 'manage' | 'self') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const canManage = hasCapability(grants, 'manage_strikes');
  if (mode === 'manage') {
    if (!canManage) return { error: NextResponse.json({ error: 'Strikes are private to exec and HR.' }, { status: 403 }) };
  } else if (!isTracked(roles ?? [])) {
    return { error: NextResponse.json({ error: 'Strikes are tracked for officers, leads and exec.' }, { status: 403 }) };
  }
  return { user, roles: grants, svc, canManage };
}

// Nobody changes their own record: someone else has to (so nobody can add, remove or reinstate their own strikes).
export const notYourOwn = () => NextResponse.json({ error: 'You can’t change your own strikes. Someone else has to.' }, { status: 403 });

export interface StrikeView {
  id: string; status: 'draft' | 'published' | 'removed'; category: StrikeCategory; reason: string; incident_date: string;
  published_at: string | null; removed_at: string | null; removed_how: 'taken' | 'voucher' | 'reset' | null; removed_note: string | null;
  meeting_id: string | null; created_by: string | null; published_by: string | null; removed_by: string | null; created_at: string;
}
// The history: one line for every action, with the reason given. A person sees what happened and why; HR and exec also see who did it.
export type StrikeEventKind = 'strikes_reset' | 'strike_added' | 'strike_removed' | 'strike_reinstated' | 'voucher_given' | 'voucher_used' | 'voucher_removed';
export async function recordEvent(svc: SupabaseClient, e: { userId: string; kind: StrikeEventKind; reason: string | null; actorId: string | null; strikeId?: string | null; voucherId?: string | null; label?: string | null }) {
  await svc.from('strike_events').insert({ user_id: e.userId, kind: e.kind, reason: e.reason, label: e.label ?? null, actor_id: e.actorId, strike_id: e.strikeId ?? null, voucher_id: e.voucherId ?? null });
}
export const cleanReason = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);
export interface VoucherView { id: string; reason: string | null; created_at: string; used_at: string | null; used_on_strike_id: string | null }

// What a person sees about themselves: published strikes (category, date, reason) and what was taken off, and their vouchers (how and when they
// got each, and when one was used). Never drafts, and never who in HR (or which exec or lead) did what.
export interface MyStrike { id: string; status: 'published' | 'removed'; category: StrikeCategory; reason: string; incident_date: string; removed_how: 'taken' | 'voucher' | 'reset' | null; removed_note: string | null; mark: string | null }
export interface MyVoucher { id: string; reason: string | null; given_on: string; used_on: string | null; used_for: string | null; removed_on: string | null; removed_reason: string | null }
export interface MyEvent { id: string; kind: StrikeEventKind; label: string | null; reason: string | null; on: string }
export async function mySummary(svc: SupabaseClient, userId: string) {
  const [{ data: s }, { data: v }, { data: ev }] = await Promise.all([
    svc.from('strikes').select('id, status, category, reason, incident_date, removed_how, removed_note').eq('user_id', userId).in('status', ['published', 'removed']).order('incident_date', { ascending: false }).order('created_at', { ascending: false }),
    svc.from('strike_vouchers').select('id, reason, created_at, used_at, used_on_strike_id, removed_at, removed_reason').eq('user_id', userId).order('created_at', { ascending: false }),
    svc.from('strike_events').select('id, kind, label, reason, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ]);
  const marks = markLabels([...(s ?? [])].filter((x) => x.status === 'published').reverse() as { id: string }[]);
  const strikes: MyStrike[] = (s ?? []).map((x) => ({ id: x.id as string, status: x.status as 'published' | 'removed', category: x.category as StrikeCategory, reason: x.reason as string, incident_date: x.incident_date as string, removed_how: x.removed_how as 'taken' | 'voucher' | 'reset' | null, removed_note: x.removed_note as string | null, mark: marks.get(x.id as string) ?? null }));
  const reasonOf = new Map(strikes.map((x) => [x.id, x.reason]));
  const vouchers: MyVoucher[] = (v ?? []).map((x) => ({ id: x.id as string, reason: x.reason as string | null, given_on: (x.created_at as string).slice(0, 10), used_on: x.used_at ? (x.used_at as string).slice(0, 10) : null, used_for: x.used_on_strike_id ? reasonOf.get(x.used_on_strike_id as string) ?? null : null, removed_on: x.removed_at ? (x.removed_at as string).slice(0, 10) : null, removed_reason: x.removed_reason as string | null }));
  const history: MyEvent[] = (ev ?? []).map((x) => ({ id: x.id as string, kind: x.kind as StrikeEventKind, label: x.label as string | null, reason: x.reason as string | null, on: (x.created_at as string).slice(0, 10) }));
  const active = strikes.filter((x) => x.status === 'published').length;
  return { limit: STRIKE_LIMIT, active, atLimit: active >= STRIKE_LIMIT, vouchers: vouchers.filter((x) => !x.used_on && !x.removed_on).length, strikes, voucherList: vouchers, history };
}

// `inactive`: sitting the quarter out. Their record and vouchers stay (and a reset still clears their strikes), but no new strike can be added and nothing is suggested.
export interface TrackedPerson { id: string; name: string; avatar_url: string | null; role: string; roleRank: number; inactive: boolean }
export async function trackedPeople(svc: SupabaseClient): Promise<TrackedPerson[]> {
  const { data: grants } = await svc.from('user_roles').select('user_id, role').in('role', [...TRACKED_ROLES]);
  const rolesOf = new Map<string, AppRole[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), g.role as AppRole]);
  const idle = await inactiveIds(svc);
  const ids = [...rolesOf.keys()];
  if (!ids.length) return [];
  const { data: ps } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', ids);
  return (ps ?? []).map((p) => {
    const top = [...(rolesOf.get(p.id as string) ?? [])].sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return { id: p.id as string, name: staffName(p), avatar_url: resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }), role: top ? ROLE_LABELS[top] : '', roleRank: top ? ROLE_DISPLAY_RANK[top] : 0, inactive: idle.has(p.id as string) };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Everyone who can manage strikes: admins and exec, plus anyone (or any saved group) given the permission in Admin → Access.
export async function strikeManagers(svc: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  const [{ data: byRole }, { data: grants }] = await Promise.all([
    svc.from('user_roles').select('user_id').in('role', ['admin', 'exec']),
    svc.from('capability_grants').select('user_id, group_id').eq('capability', 'manage_strikes'),
  ]);
  for (const r of byRole ?? []) ids.add(r.user_id as string);
  const groupIds = (grants ?? []).map((g) => g.group_id as string | null).filter((x): x is string => !!x);
  for (const g of grants ?? []) if (g.user_id) ids.add(g.user_id as string);
  if (groupIds.length) { const { data: gs } = await svc.from('meeting_groups').select('member_ids').in('id', groupIds); for (const g of gs ?? []) for (const m of (g.member_ids as string[]) ?? []) ids.add(m); }
  return [...ids];
}

// Notices are deliberately plain: they can show on a lock screen, so they say a strike changed, not what it was for.
export async function notifyPerson(svc: SupabaseClient, userId: string, title: string, body: string) {
  await createNotifications(svc, [{ user_id: userId, type: 'strike_update', title, body, href: '/portal/profile/strikes' }]);
}

export async function notifyManagers(svc: SupabaseClient, title: string, body: string, except?: string, quiet = false) {
  if (quiet) return;
  const managers = (await strikeManagers(svc)).filter((m) => m !== except);
  if (managers.length) await createNotifications(svc, managers.map((m) => ({ user_id: m, type: 'strike_update', title, body, href: '/portal/strikes' })));
}

// Reaching the limit: tell the person the HR team will contact them, and tell the managers.
export async function notifyLimit(svc: SupabaseClient, userId: string, name: string, quiet = false) {
  await notifyPerson(svc, userId, `You’re at ${STRIKES_AT_LIMIT} strikes`, 'The HR team will be contacting you. Details are in your Profile, under Strikes.');
  await notifyManagers(svc, `${name} reached ${STRIKES_AT_LIMIT} strikes`, 'They have been told the HR team will contact them.', userId, quiet);
}

export async function activeCount(svc: SupabaseClient, userId: string): Promise<number> {
  const { count } = await svc.from('strikes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'published');
  return count ?? 0;
}

export interface Suggestion { user_id: string; name: string; meeting_id: string; title: string; date: string }
// Missed meetings that might deserve a strike: a tracked person the meeting was meant for, who didn't check in and wasn't excused, for a
// meeting that has finished since the tracker began (shown as soon as it ends). exec or HR decides each one (add a strike, or dismiss it); nothing is created automatically.
export async function suggestions(svc: SupabaseClient, people?: TrackedPerson[]): Promise<Suggestion[]> {
  const today = pacificDayKey();
  const { data: setting } = await svc.from('strike_settings').select('value').eq('key', 'suggest_from').maybeSingle();
  const from = (setting?.value as string | undefined) ?? today;
  const { data: all } = await svc.from('meetings').select('id, title, meeting_date, ends_at, audience, invitees, group_ids').eq('cancelled', false).not('opened_at', 'is', null).gte('meeting_date', from).lte('meeting_date', today).order('meeting_date', { ascending: false }).limit(200);
    const finished = (all ?? []).filter((m) => new Date(m.ends_at as string).getTime() < Date.now() - EXCUSE_WINDOW_MS);
  if (!finished.length) return [];
  const meetings = await attachExtras(svc, finished.map((m) => ({ ...m, invitees: m.invitees as string[] | null, group_ids: m.group_ids as string[] | null })));
  const ids = meetings.map((m) => m.id as string);
  const tracked = people ?? await trackedPeople(svc);
  const trackedIds = tracked.map((p) => p.id);
  if (!trackedIds.length) return [];
  const [{ data: here }, { data: abs }, { data: roleRows }, { data: struck }, { data: dismissed }, { data: clearedRows }] = await Promise.all([
    svc.from('meeting_attendance').select('meeting_id, user_id').in('meeting_id', ids),
    svc.from('meeting_absences').select('meeting_id, user_id, excused').in('meeting_id', ids),
    svc.from('user_roles').select('user_id, role').in('user_id', trackedIds),
    svc.from('strikes').select('user_id, meeting_id').in('meeting_id', ids),
    svc.from('strike_dismissals').select('user_id, meeting_id').in('meeting_id', ids),
    svc.from('strike_cleared').select('user_id, cleared_at').in('user_id', trackedIds),
  ]);
  // After a reset, meetings that ended before it are never suggested again for that person.
  const clearedAt = new Map((clearedRows ?? []).map((c) => [c.user_id as string, new Date(c.cleared_at as string).getTime()]));
  const present = new Set((here ?? []).map((r) => `${r.meeting_id}|${r.user_id}`));
  const excused = new Set((abs ?? []).filter((a) => a.excused === true).map((a) => `${a.meeting_id}|${a.user_id}`));
  const done = new Set([...(struck ?? []), ...(dismissed ?? [])].map((r) => `${r.meeting_id}|${r.user_id}`));
  const rolesOf = new Map<string, { role: string }[]>();
  for (const r of roleRows ?? []) rolesOf.set(r.user_id as string, [...(rolesOf.get(r.user_id as string) ?? []), { role: r.role as string }]);
  const out: Suggestion[] = [];
  for (const m of meetings) for (const p of tracked) {
    if (p.inactive) continue;   // no strike can be added while inactive, even for a meeting they were added to by name
    const k = `${m.id}|${p.id}`;
    if (present.has(k) || excused.has(k) || done.has(k)) continue;
    if (new Date(m.ends_at as string).getTime() <= (clearedAt.get(p.id) ?? 0)) continue;
    if (!isExpectedActive({ audience: m.audience as string[] | null, invitees: m.invitees, group_ids: m.group_ids, extra_ids: m.extra_ids }, p.id, rolesOf.get(p.id) ?? [])) continue;
    out.push({ user_id: p.id, name: p.name, meeting_id: m.id as string, title: m.title as string, date: m.meeting_date as string });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

// Misses that were already dealt with, for the "Past missed meetings" list: a strike was added, or exec/HR dismissed it. Excused people are not
// listed anywhere here (they are excused on the meeting itself). Dismissed ones can be put back on the list.
export interface PastMiss { user_id: string; name: string; meeting_id: string; title: string; date: string; outcome: 'strike' | 'dismissed'; reason: string | null }
export async function pastMisses(svc: SupabaseClient, people?: TrackedPerson[]): Promise<PastMiss[]> {
  const today = pacificDayKey();
  const { data: setting } = await svc.from('strike_settings').select('value').eq('key', 'suggest_from').maybeSingle();
  const from = (setting?.value as string | undefined) ?? today;
  const { data: ms } = await svc.from('meetings').select('id, title, meeting_date').eq('cancelled', false).not('opened_at', 'is', null).gte('meeting_date', from).lte('meeting_date', today).order('meeting_date', { ascending: false }).limit(200);
  if (!ms?.length) return [];
  const ids = ms.map((m) => m.id as string);
  const tracked = people ?? await trackedPeople(svc);
  const who = new Map(tracked.map((p) => [p.id, p.name]));
  const [{ data: struck }, { data: dism }] = await Promise.all([
    svc.from('strikes').select('user_id, meeting_id, status').in('meeting_id', ids).neq('status', 'draft'),
    svc.from('strike_dismissals').select('meeting_id, user_id, reason').in('meeting_id', ids),
  ]);
  const meeting = new Map(ms.map((m) => [m.id as string, m]));
  const out = new Map<string, PastMiss>();
  const put = (uid: string, mid: string, outcome: PastMiss['outcome'], reason: string | null) => {
    const name = who.get(uid); const m = meeting.get(mid);
    if (!name || !m) return;
    out.set(`${uid}|${mid}`, { user_id: uid, name, meeting_id: mid, title: m.title as string, date: m.meeting_date as string, outcome, reason });
  };
  // Weakest first, so the strongest outcome wins when someone has more than one.
  for (const d of dism ?? []) put(d.user_id as string, d.meeting_id as string, 'dismissed', d.reason as string | null);
  for (const k of struck ?? []) put(k.user_id as string, k.meeting_id as string, 'strike', null);
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)).slice(0, 150);
}

// ── the moves that touch strikes and vouchers together ────────────────────────────────────────────────────────────────────────

// Spend a voucher on a published strike: one voucher removes exactly one strike or warning, and the voucher is then deleted (the history keeps the
// record). The conditional delete means a voucher can't be spent twice if two things happen at once. Returns whether it worked.
export async function spendVoucher(svc: SupabaseClient, voucherId: string, strikeId: string, actorId: string, note: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: spent } = await svc.from('strike_vouchers').delete().eq('id', voucherId).is('used_at', null).is('removed_at', null).select('id, user_id');
  if (!spent?.length) return false;
  await svc.from('strikes').update({ status: 'removed', removed_by: actorId, removed_at: now, removed_how: 'voucher', voucher_id: null, removed_note: note }).eq('id', strikeId);
  await recordEvent(svc, { userId: spent[0].user_id as string, kind: 'voucher_used', reason: note, actorId, strikeId });
  return true;
}

// Publish a strike the moment it is added. If the person has a voucher it is used straight away on their oldest strike (so the
// count stays the same and everything after it moves up a place). Reaching the limit alerts the person and HR.
export async function publishStrike(svc: SupabaseClient, strike: { id: string; user_id: string }, actorId: string, name: string, quiet = false): Promise<{ voucherUsed: boolean }> {
  const before = await activeCount(svc, strike.user_id);
  const { data: row } = await svc.from('strikes').select('reason').eq('id', strike.id).maybeSingle();
  await recordEvent(svc, { userId: strike.user_id, kind: 'strike_added', reason: (row?.reason as string | undefined) ?? null, actorId, strikeId: strike.id, label: before === 0 ? 'Warning' : `Strike ${before}` });
  await svc.from('strikes').update({ status: 'published', published_by: actorId, published_at: new Date().toISOString() }).eq('id', strike.id);
  // A voucher they were holding removes their OLDEST strike (by when it happened), which may be this new one; the rest move up a place.
  const { data: spare } = await svc.from('strike_vouchers').select('id').eq('user_id', strike.user_id).is('used_at', null).is('removed_at', null).order('created_at').limit(1);
  if (spare?.length) {
    const { data: oldest } = await svc.from('strikes').select('id').eq('user_id', strike.user_id).eq('status', 'published').order('incident_date').order('created_at').limit(1);
    if (oldest?.length && await spendVoucher(svc, spare[0].id as string, oldest[0].id as string, actorId, 'Used automatically when a strike was added')) {
      await logAudit(svc, { actorId, action: 'publish', entityType: 'strike', entityId: strike.id, summary: `Added a strike for ${name}; their voucher removed their oldest strike automatically` });
      await notifyPerson(svc, strike.user_id, 'Your strikes were updated', 'A voucher was used automatically on your oldest strike. Open your Profile, under Strikes.');
      return { voucherUsed: true };
    }
  }
  await logAudit(svc, { actorId, action: 'publish', entityType: 'strike', entityId: strike.id, summary: `Added a strike for ${name}` });
  if (crossesLimit(before, before + 1)) await notifyLimit(svc, strike.user_id, name, quiet);
  else await notifyPerson(svc, strike.user_id, 'Your strikes were updated', 'Open your Profile, under Strikes, to see it.');
  return { voucherUsed: false };
}

// Give someone a voucher. If they already have a strike, the voucher removes their oldest one right away; with none it waits and is used
// automatically on their next published strike.
export async function giveVoucher(svc: SupabaseClient, userId: string, reason: string, actorId: string, name: string): Promise<{ id: string; usedOnStrike: boolean } | null> {
  const { data, error } = await svc.from('strike_vouchers').insert({ user_id: userId, reason, created_by: actorId }).select('id').single();
  if (error || !data) return null;
  await logAudit(svc, { actorId, action: 'create', entityType: 'strike voucher', entityId: data.id, summary: `Gave ${name} a strike voucher` });
  await recordEvent(svc, { userId, kind: 'voucher_given', reason, actorId, voucherId: data.id as string });
  const { data: oldest } = await svc.from('strikes').select('id').eq('user_id', userId).eq('status', 'published').order('incident_date').order('created_at').limit(1);
  if (oldest?.length && await spendVoucher(svc, data.id as string, oldest[0].id as string, actorId, 'Used automatically on their existing strike')) {
    await notifyPerson(svc, userId, 'Your strikes were updated', 'You received a voucher and it was used to remove a strike. Open your Profile, under Strikes.');
    return { id: data.id as string, usedOnStrike: true };
  }
  await notifyPerson(svc, userId, 'You have a strike voucher', 'It is used automatically on your next strike. Open your Profile, under Strikes.');
  return { id: data.id as string, usedOnStrike: false };
}
