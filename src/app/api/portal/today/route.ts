import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { checkInOpensAt, getTodaysMeetings, isCheckInAccepting, isMeetingOpen } from '@/lib/meetings/meetings';
import { canAttendMeeting } from '@/lib/meetings/meetingAudience';

export const dynamic = 'force-dynamic';

// What needs this person today, for the Dashboard's Today cards. Each part is only worked out for people who may see it, and is null (or empty) for everyone else:
//   meetings   today's meetings they are invited to (is check-in open, are they in)
//   newspaper  senders: how many issues wait for their check (not ones they asked for); writers: how many of their own issues are waiting for a sender
//   qa         hosts: the open Q&A sessions that have questions waiting for approval
export async function GET() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return NextResponse.json({ meetings: [], newspaper: null, qa: [] });
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));

  const meetings = async () => {
    if (!hasCapability(grants, 'attend_meetings')) return [];
    const todays = (await getTodaysMeetings(svc)).filter((m) => canAttendMeeting(m, user.id, grants) && new Date(m.ends_at).getTime() > Date.now());
    if (!todays.length) return [];
    const { data: mine } = await svc
      .from('meeting_attendance')
      .select('meeting_id, checked_in_at')
      .eq('user_id', user.id)
      .in(
        'meeting_id',
        todays.map((m) => m.id),
      );
    const inAt = new Map((mine ?? []).map((r) => [r.meeting_id as string, r.checked_in_at as string]));
    return todays.map((m) => ({
      id: m.id,
      title: m.title,
      location: m.location,
      starts_at: m.starts_at,
      opens_at: new Date(checkInOpensAt(m)).toISOString(),
      accepting: isCheckInAccepting(m),
      open: isMeetingOpen(m),
      checked_in_at: inAt.get(m.id) ?? null,
    }));
  };
  const newspaper = async () => {
    const canSend = hasCapability(grants, 'send_newspaper');
    if (!canSend && !hasCapability(grants, 'write_newspaper')) return null;
    const { data } = await svc.from('newspaper_issues').select('slug, title, review_by, created_by').eq('status', 'review').limit(50);
    const rows = data ?? [];
    return {
      waiting: canSend ? rows.filter((r) => r.review_by !== user.id && r.created_by !== user.id).length : 0,
      mine: rows.filter((r) => r.review_by === user.id).length,
      first: canSend ? (rows.find((r) => r.review_by !== user.id && r.created_by !== user.id)?.slug ?? null) : null,
    };
  };
  const qa = async () => {
    if (!hasCapability(grants, 'host_trivia')) return [];
    const { data: sessions } = await svc.from('qa_sessions').select('id, slug, name').eq('status', 'open').limit(20);
    if (!sessions?.length) return [];
    const { data: pending } = await svc
      .from('qa_questions')
      .select('session_id')
      .eq('status', 'pending')
      .in(
        'session_id',
        sessions.map((s) => s.id),
      )
      .limit(5000);
    return sessions
      .map((s) => ({ slug: s.slug as string, name: s.name as string, pending: (pending ?? []).filter((p) => p.session_id === s.id).length }))
      .filter((s) => s.pending > 0);
  };
  const [m, n, q] = await Promise.all([meetings(), newspaper(), qa()]);
  return NextResponse.json({ meetings: m, newspaper: n, qa: q });
}
