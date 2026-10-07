import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { staffName } from '@/lib/members/names';
import { UUID } from '@/lib/docs/docsServer';
import { STATION_COLS, mayClaim, type ShiftChecklistItem, type ShiftEventGuide, type ShiftHandoff, type ShiftGrid, type ShiftPlan, type ShiftStation } from '@/lib/shifts/shifts';

export { UUID };
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Everyone on the team can look; 'manage_shifts' (exec, admin) sets things up. The routes use the service client, so this is the real boundary.
export async function authorizeShifts(need: 'view' | 'manage') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const svc = createServiceClient();
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const manage = hasCapability(grants, 'manage_shifts');
  if (need === 'manage' ? !manage : !(manage || hasCapability(grants, 'signup_shifts'))) {
    return { error: NextResponse.json({ error: need === 'manage' ? 'Only exec can set up shifts.' : 'Shifts are for officers, leads and exec.' }, { status: 403 }) };
  }
  return { user, svc, roles: grants, manage };
}

/** The person and event a manager's change is about: null if either does not exist or the person is not on the shift roster (officer, lead, exec). Used to name them in the audit log. */
export async function shiftSubject(svc: SupabaseClient, eventId: string, userId: string): Promise<{ who: string; title: string } | null> {
  const [{ data: ev }, { data: roles }, { data: p }] = await Promise.all([
    svc.from('events').select('title').eq('id', eventId).maybeSingle(),
    svc.from('user_roles').select('role').eq('user_id', userId).in('role', ['officer', 'lead', 'exec']),
    svc.from('profiles').select('id, display_name, google_first_name, google_last_name').eq('id', userId).maybeSingle(),
  ]);
  if (!ev || !p || !(roles ?? []).length) return null;
  return { who: staffName(p as never), title: ev.title as string };
}

/** The whole grid for one event, as the signed-in person sees it. */
export async function loadGrid(svc: SupabaseClient, eventId: string, me: string, roles: { role: string }[], manage: boolean): Promise<ShiftGrid | null> {
  const { data: ev } = await svc.from('events').select('id, title, start_date, location').eq('id', eventId).maybeSingle();
  if (!ev) return null;
  const [{ data: plan }, { data: stations }, { data: overrides }, { data: signups }, { data: guides }] = await Promise.all([
    svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes, signup_open, team_only, min_per_person').eq('event_id', eventId).maybeSingle(),
    svc.from('shift_stations').select(STATION_COLS).order('sort_order').order('name'),
    svc.from('shift_overrides').select('station_id, slot_index, needed').eq('event_id', eventId),
    svc.from('shift_signups').select('id, station_id, slot_index, user_id, arrived_at').eq('event_id', eventId).order('created_at'),
    svc.from('shift_event_guides').select('station_id, location, notes, doc_id, link_url, link_label').eq('event_id', eventId),
  ]);
  const ids = [...new Set((signups ?? []).map((s) => s.user_id as string))];
  const { data: people } = ids.length ? await svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const teamOnly = (plan as ShiftPlan | null)?.team_only ?? true;
  const { data: gone } = await svc.from('shift_absences').select('id, user_id, starts_at, ends_at, needs').eq('event_id', eventId).order('starts_at');
  const absentIds = new Set((gone ?? []).map((g) => g.user_id as string));
  // The requirement: every active officer and lead needs at least this many slots (fewer if they are away for part of the event).
  // Inactive (exempt) people have none, but may still sign up.
  let requirement: ShiftGrid['requirement'] = null;
  let officers: { id: string; name: string }[] = [];
  let roster: { id: string; name: string }[] = [];
  const min = (plan as ShiftPlan | null)?.min_per_person ?? null;
  const nameRow = async (idList: string[]) => {
    const { data } = idList.length ? await svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', idList) : { data: [] };
    return new Map((data ?? []).map((p) => [p.id as string, staffName(p as never)]));
  };
  let absences: ShiftGrid['absences'] = [];
  let exemptions: ShiftGrid['exemptions'] = [];
  const counts = new Map<string, number>();
  for (const sg of signups ?? []) counts.set(sg.user_id as string, (counts.get(sg.user_id as string) ?? 0) + 1);
  if (manage) {
    const { data: rows } = await svc.from('user_roles').select('user_id, role').in('role', ['officer', 'lead', 'exec', 'inactive']);
    const exempt = new Set((rows ?? []).filter((r) => r.role === 'inactive').map((r) => r.user_id as string));
    const rosterIds = [...new Set((rows ?? []).filter((r) => r.role !== 'inactive').map((r) => r.user_id as string))];
    // Officers, leads and exec all have the requirement unless they are inactive or exempted for this event.
    const { data: ex } = await svc.from('shift_exemptions').select('id, user_id, note').eq('event_id', eventId);
    const eventExempt = new Map((ex ?? []).map((e) => [e.user_id as string, e]));
    const staff = [...new Set(rosterIds)];
    const required = staff.filter((id) => !exempt.has(id) && !eventExempt.has(id));
    const exemptList = staff.filter((id) => exempt.has(id) || eventExempt.has(id));
    const names = await nameRow([...new Set([...rosterIds, ...absentIds, ...exemptList])]);
    exemptions = (ex ?? []).map((e) => ({ id: e.id as string, user_id: e.user_id as string, name: names.get(e.user_id as string) ?? 'Someone', note: (e.note as string | null) ?? null }));
    roster = rosterIds.map((id) => ({ id, name: names.get(id) ?? 'Someone' })).sort((a, b) => a.name.localeCompare(b.name));
    officers = required.map((id) => ({ id, name: names.get(id) ?? 'Someone' })).sort((a, b) => a.name.localeCompare(b.name));
    absences = (gone ?? []).map((g) => ({ id: g.id as string, user_id: g.user_id as string, name: names.get(g.user_id as string) ?? 'Someone', starts_at: g.starts_at as string, ends_at: g.ends_at as string, needs: g.needs as number }));
    if (min) {
      requirement = {
        min,
        // Everyone who has a requirement, the ones still short first; inactive (exempt) officers are listed apart.
        people: officers.map((o) => { const isAbsent = absentIds.has(o.id); return { id: o.id, name: o.name, count: counts.get(o.id) ?? 0, need: isAbsent ? Math.min(min, ...(gone ?? []).filter((g) => g.user_id === o.id).map((g) => g.needs as number)) : min, absent: isAbsent }; })
          .sort((a, b) => Number(a.count >= a.need) - Number(b.count >= b.need) || (a.count - a.need) - (b.count - b.need) || a.name.localeCompare(b.name)),
        exempt: exemptList.map((id) => ({ id, name: names.get(id) ?? 'Someone', count: counts.get(id) ?? 0, reason: (eventExempt.has(id) ? 'event' : 'inactive') as 'event' | 'inactive', note: (eventExempt.get(id)?.note as string | null) ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
      };
    }
  } else {
    const { data: mine } = await svc.from('shift_exemptions').select('id, note').eq('event_id', eventId).eq('user_id', me);
    exemptions = (mine ?? []).map((e) => ({ id: e.id as string, user_id: me, name: 'You', note: (e.note as string | null) ?? null }));
    absences = (gone ?? []).filter((g) => g.user_id === me).map((g) => ({ id: g.id as string, user_id: me, name: 'You', starts_at: g.starts_at as string, ends_at: g.ends_at as string, needs: g.needs as number }));
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: coverRows } = await svc.from('shift_cover_requests').select('id, station_id, slot_index, requester_id, note, status, taken_by, resolved_at').eq('event_id', eventId).in('status', ['open', 'taken']).order('created_at');
  const liveCovers = (coverRows ?? []).filter((c) => c.status === 'open' || (c.resolved_at as string) >= weekAgo);
  const coverNames = await nameRow([...new Set(liveCovers.flatMap((c) => [c.requester_id as string, ...(c.taken_by ? [c.taken_by as string] : [])]))]);
  const covers = liveCovers.map((c) => ({ id: c.id as string, station_id: c.station_id as string, slot_index: c.slot_index as number, requester_id: c.requester_id as string, requester_name: coverNames.get(c.requester_id as string) ?? 'Someone', note: (c.note as string | null) ?? null, status: c.status as 'open' | 'taken', taken_by: (c.taken_by as string | null) ?? null, taken_by_name: c.taken_by ? coverNames.get(c.taken_by as string) ?? 'Someone' : null }));
  const { data: itemRows } = await svc.from('shift_checklist_items').select('id, station_id, label, done_by, done_at').eq('event_id', eventId).order('sort_order');
  const itemNames = await nameRow([...new Set((itemRows ?? []).map((i) => i.done_by as string | null).filter(Boolean) as string[])]);
  const checklists: Record<string, ShiftChecklistItem[]> = {};
  for (const i of itemRows ?? []) (checklists[i.station_id as string] ??= []).push({ id: i.id as string, label: i.label as string, done_by_name: i.done_by ? itemNames.get(i.done_by as string) ?? 'Someone' : null, done_at: (i.done_at as string | null) ?? null });
  const { data: noteRows } = await svc.from('shift_handoff_notes').select('id, station_id, author_id, body, created_at').eq('event_id', eventId).order('created_at', { ascending: false });
  const noteNames = await nameRow([...new Set((noteRows ?? []).map((n) => n.author_id as string | null).filter(Boolean) as string[])]);
  const handoffs: Record<string, ShiftHandoff[]> = {};
  for (const n of noteRows ?? []) { const list = (handoffs[n.station_id as string] ??= []); if (list.length < 3) list.push({ id: n.id as string, body: n.body as string, author_name: n.author_id ? noteNames.get(n.author_id as string) ?? 'Someone' : 'Someone', created_at: n.created_at as string }); }
  return {
    requirement, absences, covers, checklists, handoffs, exemptions, officers, roster,
    event: ev as ShiftGrid['event'],
    plan: (plan as ShiftPlan | null) ?? null,
    stations: await withDocTitles(svc, (stations ?? []) as ShiftStation[]),
    eventGuides: await eventGuideMap(svc, guides ?? []),
    overrides: Object.fromEntries((overrides ?? []).map((o) => [`${o.station_id}|${o.slot_index}`, o.needed as number])),
    signups: (signups ?? []).map((s) => {
      const p = byId.get(s.user_id as string);
      return { id: s.id as string, station_id: s.station_id as string, slot_index: s.slot_index as number, user_id: s.user_id as string, name: p ? staffName(p as never) : 'Someone', avatar: ((p?.custom_avatar_url ?? p?.avatar_url) as string | null) ?? null, arrived_at: (s.arrived_at as string | null) ?? null };
    }),
    me,
    canManage: manage,
    canSignUp: manage || mayClaim(roles, teamOnly),
  };
}

/** Fills in the title of each station's linked portal doc, so the guide can show a readable link. */
export async function withDocTitles(svc: SupabaseClient, stations: ShiftStation[]): Promise<ShiftStation[]> {
  const ids = [...new Set(stations.map((s) => s.doc_id).filter(Boolean) as string[])];
  if (!ids.length) return stations;
  const { data } = await svc.from('docs').select('id, title').in('id', ids);
  const titles = new Map((data ?? []).map((d) => [d.id as string, d.title as string]));
  return stations.map((s) => ({ ...s, doc_title: s.doc_id ? titles.get(s.doc_id) ?? null : null }));
}

export async function eventGuideMap(svc: SupabaseClient, rows: Record<string, unknown>[]): Promise<Record<string, ShiftEventGuide>> {
  const ids = [...new Set(rows.map((r) => r.doc_id).filter(Boolean) as string[])];
  const { data } = ids.length ? await svc.from('docs').select('id, title').in('id', ids) : { data: [] };
  const titles = new Map((data ?? []).map((d) => [d.id as string, d.title as string]));
  return Object.fromEntries(rows.map((r) => [r.station_id as string, {
    location: (r.location as string | null) ?? null, notes: (r.notes as string | null) ?? null, doc_id: (r.doc_id as string | null) ?? null,
    doc_title: r.doc_id ? titles.get(r.doc_id as string) ?? null : null, link_url: (r.link_url as string | null) ?? null, link_label: (r.link_label as string | null) ?? null,
  }]));
}

/** Tells everyone looking at this event's shifts that something changed, so their page refreshes right away instead of polling. Failing to send is harmless: pages also refresh slowly on their own. */
/** The channel for changes that affect every event's shifts (the stations list). */
export const STATIONS_CHANNEL = 'stations';

export async function notifyShifts(eventId: string) {
  const send = async () => {
    const svc = createServiceClient();
    const channel = svc.channel(`shifts:${eventId}`);
    const sent = await channel.httpSend('changed', {});
    if (!sent.success) console.warn('shift broadcast was not accepted', sent);
    await svc.removeChannel(channel);
  };
  // Never holds up (or fails) the shift change itself: give up after a moment.
  try { await Promise.race([send(), new Promise((resolve) => setTimeout(resolve, 1500))]); } catch (e) { console.warn('shift broadcast failed', e); }
}
