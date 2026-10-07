import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { createNotifications } from '@/lib/notify';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shiftsServer';
import { mayClaim, slotCount, slotRange } from '@/lib/shifts';
import { staffName } from '@/lib/names';
import { PACIFIC_TZ } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

// Swap and cover requests. Body: { action, ... }
//   ask    { station_id, slot_index, note? }  you can't work a shift you hold: the team is told and anyone eligible can take it
//   take   { request_id }                      you cover it: it moves to you, the requester and exec are told
//   cancel { request_id }                      the requester (or exec) withdraws an open request
//   undo   { request_id }                      exec puts a taken cover back the way it was
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(eventId)) return bad('Event not found.', 404);
  const svc = auth.svc;
  const clock = (d: Date) => d.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' });

  const { data: plan } = await svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes, signup_open, team_only, min_per_person').eq('event_id', eventId).maybeSingle();
  if (!plan) return bad('That event has no shifts.', 404);
  const { data: ev } = await svc.from('events').select('title').eq('id', eventId).maybeSingle();
  const eventTitle = (ev?.title as string | undefined) ?? 'an event';
  const nameOf = async (ids: string[]) => {
    const { data } = ids.length ? await svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', ids) : { data: [] };
    return new Map((data ?? []).map((p) => [p.id as string, staffName(p as never)]));
  };
  const stationName = async (id: string) => ((await svc.from('shift_stations').select('name').eq('id', id).maybeSingle()).data?.name as string | undefined) ?? 'a station';
  const execIds = async () => [...new Set(((await svc.from('user_roles').select('user_id').in('role', ['exec', 'admin'])).data ?? []).map((r) => r.user_id as string))];
  const href = `/portal/shifts?event=${eventId}`;

  if (b.action === 'ask') {
    const stationId = String(b.station_id ?? ''), slot = Number(b.slot_index);
    if (!UUID.test(stationId) || !Number.isInteger(slot) || slot < 0 || slot >= slotCount(plan)) return bad('That shift does not exist.', 404);
    const range = slotRange(plan, slot);
    if (range.end.getTime() <= Date.now()) return bad('That shift is already over.', 409);
    const { data: mine } = await svc.from('shift_signups').select('id').eq('event_id', eventId).eq('station_id', stationId).eq('slot_index', slot).eq('user_id', auth.user.id).maybeSingle();
    if (!mine) return bad('You are not on that shift.', 409);
    const note = String(b.note ?? '').trim().slice(0, 200) || null;
    const { error } = await svc.from('shift_cover_requests').insert({ event_id: eventId, station_id: stationId, slot_index: slot, requester_id: auth.user.id, note });
    if (error) return bad(error.code === '23505' ? 'You already asked for cover on that shift.' : 'Couldn’t save that.', error.code === '23505' ? 409 : 500);
    const [who, st] = [(await nameOf([auth.user.id])).get(auth.user.id) ?? 'Someone', await stationName(stationId)];
    // Told: exec, plus the people already working shifts at this event who are free then (not on another station in that slot, not away).
    // The rest of the team sees the request in the Shifts tab; a bell for the whole roster would be noise.
    const [{ data: working }, { data: execRows }] = await Promise.all([
      svc.from('shift_signups').select('user_id').eq('event_id', eventId),
      svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']),
    ]);
    const roster = [...new Set([...(working ?? []), ...(execRows ?? [])].map((r) => r.user_id as string))].filter((id) => id !== auth.user.id);
    const [{ data: busy }, { data: away }] = await Promise.all([
      svc.from('shift_signups').select('user_id').eq('event_id', eventId).eq('slot_index', slot),
      svc.from('shift_absences').select('user_id').eq('event_id', eventId).lt('starts_at', range.end.toISOString()).gt('ends_at', range.start.toISOString()),
    ]);
    const skip = new Set([...(busy ?? []), ...(away ?? [])].map((r) => r.user_id as string));
    const who2 = roster.filter((id) => !skip.has(id));
    await createNotifications(svc, who2.map((user_id) => ({ user_id, type: 'shift_cover', title: `${who} needs cover: ${st} at ${clock(range.start)}`, body: `${eventTitle}${note ? ` · “${note}”` : ''}. Open Shifts to take it.`, href })));
    await logAudit(svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `${who} asked for cover on ${st}, ${clock(range.start)} slot, "${eventTitle}"` });
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true, told: who2.length });
  }

  const reqId = String(b.request_id ?? '');
  if (!UUID.test(reqId)) return bad('That request does not exist.', 404);
  const { data: req } = await svc.from('shift_cover_requests').select('id, event_id, station_id, slot_index, requester_id, status, taken_by').eq('id', reqId).eq('event_id', eventId).maybeSingle();
  if (!req) return bad('That request does not exist.', 404);
  const range = slotRange(plan, req.slot_index as number);
  const st = await stationName(req.station_id as string);
  const what = `${st}, ${clock(range.start)} slot, "${eventTitle}"`;

  if (b.action === 'take') {
    if (!auth.manage && !mayClaim(auth.roles, plan.team_only as boolean)) return bad('These shifts are for the team.', 403);
    const { data: res, error } = await svc.rpc('take_shift_cover', { p_request: reqId, p_user: auth.user.id, p_slot_start: range.start.toISOString(), p_slot_end: range.end.toISOString() });
    if (error) return bad('Couldn’t save that. Try again.', 500);
    if (res === 'gone') return bad('That request is no longer open.', 409);
    if (res === 'self') return bad('That is your own request.', 409);
    if (res === 'clash') return bad('You already work another station in that time slot.', 409);
    if (res === 'away') return bad('You are away during that time.', 409);
    const names = await nameOf([auth.user.id, req.requester_id as string]);
    const me = names.get(auth.user.id) ?? 'Someone', them = names.get(req.requester_id as string) ?? 'Someone';
    const execs = (await execIds()).filter((id) => id !== auth.user.id && id !== req.requester_id);
    await createNotifications(svc, [
      { user_id: req.requester_id as string, type: 'shift_cover', title: `${me} is covering your ${st} shift`, body: `${eventTitle}, ${clock(range.start)}. You are off it.`, href },
      ...execs.map((user_id) => ({ user_id, type: 'shift_cover', title: `${me} covers ${them} at ${st}`, body: `${eventTitle}, ${clock(range.start)}. You can undo it in Shifts.`, href })),
    ]);
    await logAudit(svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `${me} covered ${them} on ${what}`, details: { request_id: reqId } });
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'cancel') {
    if (req.requester_id !== auth.user.id && !auth.manage) return bad('Only the person who asked can withdraw it.', 403);
    const { data: done } = await svc.from('shift_cover_requests').update({ status: 'cancelled', resolved_at: new Date().toISOString() }).eq('id', reqId).eq('status', 'open').select('id');
    if (!done?.length) return bad('That request is no longer open.', 409);
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'undo') {
    if (!auth.manage) return bad('Only exec can undo a cover.', 403);
    const { data: res, error } = await svc.rpc('undo_shift_cover', { p_request: reqId });
    if (error) return bad('Couldn’t save that. Try again.', 500);
    if (res === 'gone') return bad('That cover can’t be undone any more.', 409);
    if (res === 'clash') return bad('The original person is on another station then, so it can’t go back.', 409);
    const names = await nameOf([req.requester_id as string, req.taken_by as string]);
    const them = names.get(req.requester_id as string) ?? 'Someone', other = names.get(req.taken_by as string) ?? 'Someone';
    await createNotifications(svc, [
      { user_id: req.requester_id as string, type: 'shift_cover', title: `Exec put you back on ${st}`, body: `${eventTitle}, ${clock(range.start)}. The cover by ${other} was undone.`, href },
      { user_id: req.taken_by as string, type: 'shift_cover', title: `Exec undid your cover at ${st}`, body: `${eventTitle}, ${clock(range.start)}. You are off that shift.`, href },
    ]);
    await logAudit(svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Undid ${other} covering ${them} on ${what}`, details: { request_id: reqId } });
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true });
  }
  return bad('Unknown action.');
}
