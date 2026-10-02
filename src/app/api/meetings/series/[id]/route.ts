import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, validateDocUrl, guardSeries, notifyMeetingInvites, type SeriesRow } from '@/lib/meetings';
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
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  const { data: before } = await auth.svc.from('meeting_series').select('*').eq('id', id).maybeSingle();
  const { data, error } = await auth.svc.from('meeting_series').update(patch).eq('id', id).select('title').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Failed to update.' }, { status: 500 });
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
