import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizeStrikes, cleanReason, notYourOwn, pastMisses, publishStrike, quietTest, suggestions, trackedPeople } from '@/lib/members/strikes';

export const dynamic = 'force-dynamic';

// Missed meetings exec or HR may want to strike for (a tracked person, meant to be there, no check-in, no excuse). Suggestions only.
export async function GET() {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const people = await trackedPeople(auth.svc);
  return NextResponse.json({ suggestions: await suggestions(auth.svc, people), past: await pastMisses(auth.svc, people) });
}

// Decide on one or several: add a strike for each (live straight away), or dismiss it (it isn't suggested again).
// { action: 'add' | 'dismiss' | 'excuse' | 'undo', reason?, items: [{ user_id, meeting_id }, ...] }  (a single { user_id, meeting_id } works too)
export async function POST(request: Request) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (!['add', 'dismiss', 'excuse', 'undo'].includes(b.action)) return NextResponse.json({ error: 'Choose what to do.' }, { status: 400 });
  const items: { user_id: unknown; meeting_id: unknown }[] = Array.isArray(b.items) ? b.items.slice(0, 60) : [{ user_id: b.user_id, meeting_id: b.meeting_id }];
  if (!items.length) return NextResponse.json({ error: 'Pick at least one person.' }, { status: 400 });
  if (items.some((i) => i.user_id === auth.user.id)) return notYourOwn();
  const reason = cleanReason(b.reason, 140);
  if (b.action === 'excuse' && !reason) return NextResponse.json({ error: 'Say why they’re excused (for example, “Marked absent by mistake”).' }, { status: 400 });
  // Put a dismissed miss back on the list.
  if (b.action === 'undo') {
    const past = await pastMisses(auth.svc);
    const back = items.map((i) => past.find((x) => x.user_id === i.user_id && x.meeting_id === i.meeting_id && x.outcome === 'dismissed'));
    if (back.some((x) => !x)) return NextResponse.json({ error: 'One of those can’t be put back.' }, { status: 404 });
    for (const x of back as NonNullable<(typeof back)[number]>[]) {
      await auth.svc.from('strike_dismissals').delete().eq('user_id', x.user_id).eq('meeting_id', x.meeting_id);
    }
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'undo', entityType: 'strike', entityId: items[0].meeting_id as string, summary: `Put ${items.length} missed meeting${items.length === 1 ? '' : 's'} back on the list` });
    return NextResponse.json({ ok: true, count: items.length });
  }
  const current = await suggestions(auth.svc);
  const picked = items.map((i) => current.find((x) => x.user_id === i.user_id && x.meeting_id === i.meeting_id));
  if (picked.some((x) => !x)) return NextResponse.json({ error: 'One of those is no longer on the list. Refresh and try again.' }, { status: 404 });
  const chosen = picked as NonNullable<(typeof picked)[number]>[];
  if (b.action === 'excuse') {
    // The same "excused absence" the meeting page records, so it also stops counting against their attendance.
    const { error } = await auth.svc.from('meeting_absences').upsert(chosen.map((x) => ({ meeting_id: x.meeting_id, user_id: x.user_id, reason, excused: true, marked_by: auth.user.id })), { onConflict: 'meeting_id,user_id' });
    if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'mark absent', entityType: 'meeting attendance', entityId: chosen[0].meeting_id, summary: `Marked ${chosen.length} missed-meeting suggestion${chosen.length === 1 ? '' : 's'} excused: ${reason}` });
    return NextResponse.json({ ok: true, count: chosen.length });
  }
  if (b.action === 'dismiss') {
    await auth.svc.from('strike_dismissals').upsert(chosen.map((x) => ({ user_id: x.user_id, meeting_id: x.meeting_id, dismissed_by: auth.user.id, reason: reason || null })), { onConflict: 'user_id,meeting_id' });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'dismiss', entityType: 'strike', entityId: chosen[0].meeting_id, summary: `Dismissed ${chosen.length} missed-meeting suggestion${chosen.length === 1 ? '' : 's'}` });
    return NextResponse.json({ ok: true, count: chosen.length });
  }
  const rows = chosen.map((x) => ({
    user_id: x.user_id, incident_date: x.date, meeting_id: x.meeting_id, category: 'meeting', created_by: auth.user.id,
    reason: `Missed ${x.title} on ${new Date(`${x.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })} without an excuse`,
  }));
  const { data, error } = await auth.svc.from('strikes').insert(rows).select('id, user_id');
  if (error || !data) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  const quiet = quietTest(request);
  for (const d of data) await publishStrike(auth.svc, d as { id: string; user_id: string }, auth.user.id, chosen.find((x) => x.user_id === d.user_id)?.name ?? 'someone', quiet);
  return NextResponse.json({ ids: data.map((d) => d.id), count: data.length }, { status: 201 });
}
