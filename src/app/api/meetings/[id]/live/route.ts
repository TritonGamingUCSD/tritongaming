import type { SupabaseClient } from '@supabase/supabase-js';
import { tally } from '@/lib/meetings/meetingFun';
import { NextResponse } from 'next/server';
import { checkInOpensAt, isCheckInAccepting, loadGroups, authorizeMeetings, currentMeetingCode, currentQrKey, getExpectedPeople, attachExtras, isMeetingOpen, type MeetingRow, guardMeeting } from '@/lib/meetings/meetings';
import { staffName } from '@/lib/members/names';
import { isOver, lockedExpected } from '@/lib/meetings/expectedLock';

export const dynamic = 'force-dynamic';

// Exec's projector/phone view: the current code plus who's in and who's still missing. Polled.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardMeeting(auth, id); if (denied) return denied; }
  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  const [{ data: rows }, people] = await Promise.all([
    auth.svc.from('meeting_attendance').select('user_id, checked_in_at, method').eq('meeting_id', id).order('checked_in_at', { ascending: false }),
    expectedPeopleFor(auth.svc, m),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const here = new Set((rows ?? []).map((r) => r.user_id as string));
  const expectedIds = new Set(people.map((p) => p.id));

  // Someone who checked in but no longer holds a team role still shows up in the list.
  const missingProfileIds = (rows ?? []).map((r) => r.user_id as string).filter((u) => !byId.has(u));
  if (missingProfileIds.length) {
    const { data: extra } = await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', missingProfileIds);
    for (const p of extra ?? []) byId.set(p.id as string, { id: p.id as string, name: staffName(p), avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null });
  }

  const { data: absenceRows } = await auth.svc.from('meeting_absences').select('user_id, reason, excused').eq('meeting_id', id);
  const absent = new Set((absenceRows ?? []).map((a) => a.user_id as string));
  // Answers (newest first) and the running emoji totals (a handful of rows, one per emoji; the screen works out what is new by comparing them).
  const [{ data: answerRows }, { data: countRows }] = await Promise.all([
    auth.svc.from('meeting_answers').select('user_id, answer, updated_at').eq('meeting_id', id).order('updated_at', { ascending: false }).limit(100),
    auth.svc.from('meeting_reaction_counts').select('emoji, count').eq('meeting_id', id),
  ]);
  const reactionTotals: Record<string, number> = {};
  for (const r of countRows ?? []) reactionTotals[r.emoji as string] = Number(r.count);
  const answerUserIds = [...(answerRows ?? []).map((a) => a.user_id as string), ...absent].filter((u) => !byId.has(u));
  if (answerUserIds.length) {
    const { data: extra } = await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', answerUserIds);
    for (const p of extra ?? []) byId.set(p.id as string, { id: p.id as string, name: staffName(p), avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null });
  }

  const groups = await loadGroups(auth.svc);
  const open = isMeetingOpen(m);
  const cc = open ? currentMeetingCode(m.code_secret) : null;
  return NextResponse.json({
    meeting: { id: m.id, title: m.title, meeting_date: m.meeting_date, starts_at: m.starts_at, ends_at: m.ends_at, open, doc_url: m.doc_url, location: m.location, cancelled: m.cancelled, series_id: m.series_id, open_to_team: m.open_to_team !== false, audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, groupNames: (m.group_ids ?? []).map((g) => groups.get(g)?.name ?? '').filter(Boolean), accepting: isCheckInAccepting(m), opens_at: new Date(checkInOpensAt(m)).toISOString(), question: m.question, question_type: m.question_type ?? 'text', question_options: m.question_options ?? null },
    answers: (answerRows ?? []).map((a) => ({ ...byId.get(a.user_id as string)!, answer: a.answer, at: a.updated_at })),
    reactionTotals,
    tally: tally(m.question_type ?? 'text', m.question_options ?? null, (answerRows ?? []).map((a) => a.answer as string)),
    customEmojis: await customEmojiMap(auth.svc),
    code: cc?.code ?? null,
    qrKey: open ? currentQrKey(m.code_secret) : null,
    expiresAt: cc?.expiresAt ?? null,
    // `guest`: checked in to a meeting that was not meant for them (they are not in the expected list); the host sees a Guest tag.
    attendees: (rows ?? []).map((r) => ({ ...byId.get(r.user_id as string)!, checked_in_at: r.checked_in_at, method: r.method, guest: !expectedIds.has(r.user_id as string) })),
    missing: people.filter((p) => !here.has(p.id) && !absent.has(p.id)),
    absent: (absenceRows ?? []).map((a) => ({ ...(byId.get(a.user_id as string) ?? { id: a.user_id as string, name: 'Unnamed', avatar_url: null, custom_avatar_url: null }), reason: a.reason as string | null, excused: a.excused as boolean })),
  });
}

// Who the meeting expects: live while check-in is open, the locked list once it has closed.
async function expectedPeopleFor(svc: SupabaseClient, m: MeetingRow) {
  if (!isOver(m)) return getExpectedPeople(svc, m);
  const [{ extra_ids }] = await attachExtras(svc, [{ invitees: m.invitees ?? null, group_ids: m.group_ids ?? null }]);
  const locked = (await lockedExpected(svc, [{ ...m, extra_ids }])).get(m.id);
  if (!locked || locked.size === 0) return [];
  const { data: profiles } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name, gamer_tag, avatar_url, custom_avatar_url').in('id', [...locked]);
  return (profiles ?? []).map((p) => ({ id: p.id as string, name: staffName(p, { tag: true }), avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null })).sort((a, b) => a.name.localeCompare(b.name));
}

// Approved custom emojis by id, so the screen can draw `custom:<id>` reactions.
async function customEmojiMap(svc: SupabaseClient) {
  const { data } = await svc.from('custom_emojis').select('id, name, path').eq('status', 'approved');
  return Object.fromEntries((data ?? []).map((e) => [e.id as string, { name: e.name as string, url: svc.storage.from('custom-emojis').getPublicUrl(e.path as string).data.publicUrl }]));
}
