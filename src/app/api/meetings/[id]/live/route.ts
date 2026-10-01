import { NextResponse } from 'next/server';
import { authorizeMeetings, currentMeetingCode, getExpectedPeople, isMeetingOpen, type MeetingRow } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

// Exec's projector/phone view: the current code plus who's in and who's still missing. Polled.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  const { data } = await auth.svc.from('meetings').select('*').eq('id', id).maybeSingle();
  const m = data as MeetingRow | null;
  if (!m) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

  const [{ data: rows }, people] = await Promise.all([
    auth.svc.from('meeting_attendance').select('user_id, checked_in_at, method').eq('meeting_id', id).order('checked_in_at', { ascending: false }),
    getExpectedPeople(auth.svc),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const here = new Set((rows ?? []).map((r) => r.user_id as string));

  // Someone who checked in but no longer holds a team role still shows up in the list.
  const missingProfileIds = (rows ?? []).map((r) => r.user_id as string).filter((u) => !byId.has(u));
  if (missingProfileIds.length) {
    const { data: extra } = await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', missingProfileIds);
    for (const p of extra ?? []) byId.set(p.id as string, { id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null });
  }

  // Answers (newest first) and reactions. Reactions come as a cursor: without ?after the response only
  // says where the cursor is (nothing replays); with it, just the reactions sent since then.
  const afterParam = new URL(req.url).searchParams.get('after');
  const [{ data: answerRows }, { data: reactionRows }] = await Promise.all([
    auth.svc.from('meeting_answers').select('user_id, answer, updated_at').eq('meeting_id', id).order('updated_at', { ascending: false }).limit(100),
    auth.svc.from('meeting_reactions').select('id, emoji').eq('meeting_id', id).order('id', { ascending: true }).limit(5000),
  ]);
  const allReactions = reactionRows ?? [];
  const lastReactionId = allReactions.length ? (allReactions[allReactions.length - 1].id as number) : 0;
  const after = afterParam === null ? lastReactionId : Number(afterParam) || 0;
  const reactions = allReactions.filter((r) => (r.id as number) > after).slice(0, 40).map((r) => ({ id: r.id as number, emoji: r.emoji as string }));
  const reactionTotals: Record<string, number> = {};
  for (const r of allReactions) reactionTotals[r.emoji as string] = (reactionTotals[r.emoji as string] ?? 0) + 1;
  const answerUserIds = (answerRows ?? []).map((a) => a.user_id as string).filter((u) => !byId.has(u));
  if (answerUserIds.length) {
    const { data: extra } = await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', answerUserIds);
    for (const p of extra ?? []) byId.set(p.id as string, { id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null });
  }

  const open = isMeetingOpen(m);
  const cc = open ? currentMeetingCode(m.code_secret) : null;
  return NextResponse.json({
    meeting: { id: m.id, title: m.title, meeting_date: m.meeting_date, starts_at: m.starts_at, ends_at: m.ends_at, open, doc_url: m.doc_url, location: m.location, cancelled: m.cancelled, question: m.question },
    answers: (answerRows ?? []).map((a) => ({ ...byId.get(a.user_id as string)!, answer: a.answer, at: a.updated_at })),
    reactions,
    lastReactionId: reactions.length ? reactions[reactions.length - 1].id : after,
    reactionTotals,
    code: cc?.code ?? null,
    expiresAt: cc?.expiresAt ?? null,
    attendees: (rows ?? []).map((r) => ({ ...byId.get(r.user_id as string)!, checked_in_at: r.checked_in_at, method: r.method })),
    missing: people.filter((p) => !here.has(p.id)),
  });
}
