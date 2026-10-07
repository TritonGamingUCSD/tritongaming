import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';
import { mayClaim, slotCount, slotRange } from '@/lib/shifts/shifts';
import { staffName } from '@/lib/members/names';
import { PACIFIC_TZ } from '@/lib/core/timezone';

export const dynamic = 'force-dynamic';

// Claim or give up one cell: { station_id, slot_index, join, user_id? }. Exec may also put someone else in a cell or take them out (user_id).
// Refused when signup is closed, the cell is full, or the person already works another station in the same time slot.
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('view');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const stationId = String(b.station_id ?? '');
  const slot = Number(b.slot_index);
  const join = b.join !== false;
  if (!UUID.test(eventId) || !UUID.test(stationId) || !Number.isInteger(slot) || slot < 0) return bad('That cell does not exist.', 404);
  const target = auth.manage && b.user_id ? String(b.user_id) : auth.user.id;
  if (!UUID.test(target)) return bad('Unknown person.');
  const forOther = target !== auth.user.id;

  const [{ data: plan }, { data: station }] = await Promise.all([
    auth.svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes, signup_open, team_only, min_per_person').eq('event_id', eventId).maybeSingle(),
    auth.svc.from('shift_stations').select('id, name, default_needed, sort_order').eq('id', stationId).maybeSingle(),
  ]);
  if (!plan || !station) return bad('That cell does not exist.', 404);
  if (slot >= slotCount(plan)) return bad('That time slot does not exist.', 404);

  // Every action here is written to the audit log, including the ones that were refused: who, for whom, which station and time.
  const range = slotRange(plan, slot);
  const [{ data: ev }, { data: people }] = await Promise.all([
    auth.svc.from('events').select('title').eq('id', eventId).maybeSingle(),
    auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', [...new Set([auth.user.id, target])]),
  ]);
  const nameOf = (id: string) => { const p = (people ?? []).find((x) => x.id === id); return p ? staffName(p as never) : 'Someone'; };
  const where = `${station.name}, ${range.start.toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })} slot, "${ev?.title ?? 'an event'}"`;
  const note = async (kind: 'join' | 'leave', refused?: string) => {
    const who = nameOf(auth.user.id);
    const text = refused
      ? `${who} tried to ${forOther ? `put ${nameOf(target)} on` : 'sign up for'} ${where} (refused: ${refused})`
      : kind === 'join' ? (forOther ? `${who} put ${nameOf(target)} on ${where}` : `${who} signed up for ${where}`)
      : (forOther ? `${who} took ${nameOf(target)} off ${where}` : `${who} left ${where}`);
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift', entityId: eventId, summary: text,
      details: { event_id: eventId, station_id: stationId, slot_index: slot, target_user_id: target, join: kind === 'join', refused: refused ?? null } });
  };
  if (!auth.manage) {
    if (!plan.signup_open) { await note('join', 'signup is not open'); return bad('Signup is not open yet.', 409); }
    if (!mayClaim(auth.roles, plan.team_only as boolean)) { await note('join', 'shifts are for the team'); return bad('These shifts are for the team.', 403); }
  }

  if (!join) {
    await auth.svc.from('shift_signups').delete().eq('event_id', eventId).eq('station_id', stationId).eq('slot_index', slot).eq('user_id', target);
    await note('leave');
    await notifyShifts(eventId);
    return NextResponse.json({ ok: true });
  }

  // One atomic step in the database: it takes the lock for this time slot, then checks full / already working / away and saves, so two people
  // pressing Join at the same moment can never both get the last spot.
  const { data: result, error } = await auth.svc.rpc('claim_shift', { p_event: eventId, p_station: stationId, p_slot: slot, p_user: target, p_slot_start: range.start.toISOString(), p_slot_end: range.end.toISOString() });
  if (error) { await note('join', 'database error'); return bad('Couldn’t save that. Try again.', 500); }
  if (result === 'full') { await note('join', 'the shift was full'); return bad('Someone just took the last spot there. Pick another.', 409); }
  if (result === 'clash') { await note('join', 'already on another station then'); return bad(forOther ? 'They already work another station in that time slot.' : 'You already work another station in that time slot.', 409); }
  if (result === 'away') { await note('join', 'away at that time'); return bad(forOther ? 'They are away during that time.' : 'You marked yourself away during that time.', 409); }
  await note('join');
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
