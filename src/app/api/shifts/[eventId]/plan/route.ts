import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';
import { MAX_SLOTS, SLOT_CHOICES, slotCount } from '@/lib/shifts/shifts';

export const dynamic = 'force-dynamic';

// Exec: set up (or change) the grid for an event: { starts_at, ends_at, slot_minutes, signup_open, team_only, min_per_person }.
// Shrinking the time range drops the signups and overrides that no longer have a slot.
export async function PUT(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(eventId)) return bad('Event not found.', 404);
  const startsAt = new Date(String(b.starts_at ?? ''));
  const endsAt = new Date(String(b.ends_at ?? ''));
  const slotMinutes = Number(b.slot_minutes);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return bad('The end must be after the start.');
  if (!SLOT_CHOICES.includes(slotMinutes)) return bad('Choose a slot length from the list.');
  const plan = { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), slot_minutes: slotMinutes };
  const slots = Math.ceil((endsAt.getTime() - startsAt.getTime()) / (slotMinutes * 60_000));
  if (slots > MAX_SLOTS) return bad(`That is ${slots} slots; the most is ${MAX_SLOTS}. Use longer slots or a shorter day.`);
  const minRaw = b.min_per_person;
  const minPer = minRaw === null || minRaw === undefined || minRaw === '' ? null : Number(minRaw);
  if (minPer !== null && (!Number.isInteger(minPer) || minPer < 1 || minPer > MAX_SLOTS)) return bad(`The least shifts each person needs must be a whole number from 1 to ${MAX_SLOTS}, or empty for no requirement.`);
  const { data: ev } = await auth.svc.from('events').select('title').eq('id', eventId).maybeSingle();
  if (!ev) return bad('Event not found.', 404);
  const { data: before } = await auth.svc.from('event_shifts').select('starts_at, ends_at, slot_minutes').eq('event_id', eventId).maybeSingle();
  const { error } = await auth.svc.from('event_shifts').upsert({
    event_id: eventId, ...plan, signup_open: b.signup_open === true, team_only: true, min_per_person: minPer, created_by: auth.user.id,   // team_only is always true; the column stays so old rows still read
  }, { onConflict: 'event_id' });
  if (error) return bad('Couldn’t save the plan.', 500);
  const count = slotCount(plan);
  // Moving the start or changing the slot length: people and special counts keep their clock time. A slot whose time no longer lines up with a new
  // slot (or falls outside the new range) is dropped, instead of silently landing on a different time.
  const moved = before && (new Date(before.starts_at as string).getTime() !== startsAt.getTime() || before.slot_minutes !== slotMinutes);
  if (before && moved) {
    const oldStart = new Date(before.starts_at as string).getTime();
    const remap = (i: number) => {
      const rel = oldStart + i * (before.slot_minutes as number) * 60_000 - startsAt.getTime();
      const step = slotMinutes * 60_000;
      return rel >= 0 && rel % step === 0 && rel / step < count ? rel / step : null;
    };
    const [{ data: sg }, { data: ov }] = await Promise.all([
      auth.svc.from('shift_signups').select('event_id, station_id, slot_index, user_id, arrived_at').eq('event_id', eventId),
      auth.svc.from('shift_overrides').select('event_id, station_id, slot_index, needed').eq('event_id', eventId),
    ]);
    const keepS = (sg ?? []).flatMap((r) => { const n = remap(r.slot_index as number); return n === null ? [] : [{ ...r, slot_index: n }]; });
    const keepO = (ov ?? []).flatMap((r) => { const n = remap(r.slot_index as number); return n === null ? [] : [{ ...r, slot_index: n }]; });
    await auth.svc.from('shift_signups').delete().eq('event_id', eventId);
    await auth.svc.from('shift_overrides').delete().eq('event_id', eventId);
    if (keepS.length) await auth.svc.from('shift_signups').insert(keepS);
    if (keepO.length) await auth.svc.from('shift_overrides').insert(keepO);
  } else {
    await auth.svc.from('shift_signups').delete().eq('event_id', eventId).gte('slot_index', count);
    await auth.svc.from('shift_overrides').delete().eq('event_id', eventId).gte('slot_index', count);
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: `Set up shifts for "${ev.title}" (${count} slots of ${slotMinutes} min, signup ${b.signup_open === true ? 'open' : 'closed'})` });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}

// Exec: remove the whole grid for an event (signups and overrides go with it).
export async function DELETE(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  if (!UUID.test(eventId)) return bad('Event not found.', 404);
  const { data: ev } = await auth.svc.from('events').select('title').eq('id', eventId).maybeSingle();
  await auth.svc.from('shift_signups').delete().eq('event_id', eventId);
  await auth.svc.from('shift_overrides').delete().eq('event_id', eventId);
  await auth.svc.from('event_shifts').delete().eq('event_id', eventId);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'shift', entityId: eventId, summary: `Removed the shifts for "${ev?.title ?? 'an event'}"` });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
