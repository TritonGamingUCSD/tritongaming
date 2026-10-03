import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, validateDocUrl, guardSeries, notifyMeetingInvites, occurrenceTimes, type SeriesRow } from '@/lib/meetings';
import { pacificDayKey } from '@/lib/checkinDays';
import { validateAudienceInput } from '@/lib/meetingAudience';
import { MAX_DESCRIPTION_LENGTH } from '@/lib/meetingFun';

// Pause/resume a repeating meeting, or delete it (past meetings and their attendance are kept).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardSeries(auth, id); if (denied) return denied; }
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  if ('doc_url' in body) {
    const doc = validateDocUrl(body.doc_url);
    if (!doc.ok) return NextResponse.json({ error: 'The doc link must start with https:// (or be a path on this site).' }, { status: 400 });
    patch.doc_url = doc.value;
  }
  if ('audience' in body || 'invitees' in body || 'group_ids' in body) {
    const aud = validateAudienceInput(body);
    if (!aud.ok) return NextResponse.json({ error: 'Pick who the meeting is for.' }, { status: 400 });
    patch.audience = aud.audience;
    patch.invitees = aud.invitees;
    patch.group_ids = aud.group_ids;
  }
  if ('description' in body) patch.description = String(body.description ?? '').trim().slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if ('title' in body) {
    const t = String(body.title ?? '').trim().slice(0, 60);
    if (!t) return NextResponse.json({ error: 'Give the meeting a name.' }, { status: 400 });
    patch.title = t;
  }
  if ('location' in body) patch.location = String(body.location ?? '').trim().slice(0, 80) || null;
  if ('ends_on' in body) {
    const e = body.ends_on ? String(body.ends_on) : null;
    if (e && (!/^\d{4}-\d{2}-\d{2}$/.test(e) || e < pacificDayKey())) return NextResponse.json({ error: 'The last day can’t be in the past.' }, { status: 400 });
    patch.ends_on = e;
  }
  if ('weekday' in body) {
    const w = Number(body.weekday);
    if (!Number.isInteger(w) || w < 0 || w > 6) return NextResponse.json({ error: 'Pick a day of the week.' }, { status: 400 });
    patch.weekday = w;
  }
  if ('start' in body || 'end' in body) {
    const re = /^([01]\d|2[0-3]):[0-5]\d$/;
    const st = String(body.start ?? ''), en = String(body.end ?? '');
    if (!re.test(st) || !re.test(en) || en <= st) return NextResponse.json({ error: 'Pick a start time and a later end time.' }, { status: 400 });
    patch.start_time = st;
    patch.end_time = en;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { data: before } = await auth.svc.from('meeting_series').select('*').eq('id', id).maybeSingle();
  const { data, error } = await auth.svc.from('meeting_series').update(patch).eq('id', id).select('title').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Failed to update.' }, { status: 500 });
  // Carry the change to the weeks that already exist but haven't started: a row follows the repeating
  // meeting only for the fields it still shares with it, so a week with its own room, time or doc keeps it.
  if (before) {
    const old = before as SeriesRow;
    const { data: rows } = await auth.svc.from('meetings').select('*').eq('series_id', id).is('opened_at', null).gte('meeting_date', pacificDayKey());
    const norm = (v: unknown) => (Array.isArray(v) && v.length === 0 ? null : v ?? null);
    const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
    for (const r of rows ?? []) {
      const up: Record<string, unknown> = {};
      for (const k of ['title', 'location', 'doc_url', 'description', 'audience', 'invitees', 'group_ids'] as const) {
        if (k in patch && same(r[k], old[k])) up[k] = patch[k];
      }
      const oldStart = old.start_time.slice(0, 5), oldEnd = old.end_time.slice(0, 5);
      const o = occurrenceTimes(r.meeting_date, oldStart, oldEnd);
      const unchangedTimes = new Date(r.starts_at).getTime() === o.starts.getTime() && new Date(r.ends_at).getTime() === o.ends.getTime();
      const untouched = (['title', 'location', 'doc_url', 'description', 'audience', 'invitees', 'group_ids'] as const).every((k) => same(r[k], old[k]));
      if ('weekday' in patch && patch.weekday !== old.weekday) {
        // Moved to another weekday: an uncustomized week sits on the old day, so drop it (the new day fills in
        // automatically). A customized one stays as it is, as a one-off.
        if (unchangedTimes && untouched && !r.question) await auth.svc.from('meetings').delete().eq('id', r.id);
        continue;
      }
      if (('start_time' in patch) && unchangedTimes) {
        const n = occurrenceTimes(r.meeting_date, String(patch.start_time), String(patch.end_time));
        up.starts_at = n.starts.toISOString(); up.ends_at = n.ends.toISOString();
      }
      if (Object.keys(up).length) await auth.svc.from('meetings').update(up).eq('id', r.id);
    }
  }
  if (before && 'audience' in patch) {
    const b = before as SeriesRow;
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][b.weekday];
    await notifyMeetingInvites(auth.svc, { title: data.title, when: `Every ${day}, ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}${b.location ? ` · ${b.location}` : ''}` },
      { audience: patch.audience as string[] | null, invitees: patch.invitees as string[] | null, group_ids: patch.group_ids as string[] | null }, { before: b, hostId: auth.user.id });
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'meeting series', entityId: id, summary: `Updated repeating meeting "${data.title}"`, details: patch });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardSeries(auth, id); if (denied) return denied; }
  const { data } = await auth.svc.from('meeting_series').select('title').eq('id', id).maybeSingle();
  const { error } = await auth.svc.from('meeting_series').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'meeting series', entityId: id, summary: `Deleted repeating meeting "${data?.title ?? ''}"` });
  return NextResponse.json({ ok: true });
}
