import { NextResponse } from 'next/server';
import { authorizeMeetings } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

// A team member's own check-in history: each meeting they attended (with its doc, since they were
// there) and how that compares to the meetings that were held.
export async function GET() {
  const auth = await authorizeMeetings('attend_meetings');
  if (auth.error) return auth.error;

  const [{ data: held }, { data: mine }] = await Promise.all([
    auth.svc.from('meetings').select('id, title, meeting_date').eq('cancelled', false).not('opened_at', 'is', null).order('meeting_date', { ascending: false }).limit(26),
    auth.svc.from('meeting_attendance').select('meeting_id, checked_in_at, method').eq('user_id', auth.user.id),
  ]);
  const attended = new Map((mine ?? []).map((r) => [r.meeting_id as string, r]));
  const ids = [...new Set([...(held ?? []).map((m) => m.id as string), ...attended.keys()])];
  const { data: meetings } = ids.length
    ? await auth.svc.from('meetings').select('id, title, meeting_date, doc_url, location').in('id', ids)
    : { data: [] as { id: string; title: string; meeting_date: string; doc_url: string | null; location: string | null }[] };

  const rows = (meetings ?? [])
    .map((m) => {
      const a = attended.get(m.id as string);
      return { id: m.id as string, title: m.title as string, date: m.meeting_date as string, location: m.location as string | null, attended: !!a, checked_in_at: (a?.checked_in_at as string | undefined) ?? null, method: (a?.method as string | undefined) ?? null, doc_url: a ? (m.doc_url as string | null) : null };
    })
    .sort((x, y) => y.date.localeCompare(x.date));
  const heldIds = new Set((held ?? []).map((m) => m.id as string));
  return NextResponse.json({
    meetings: rows,
    attended: rows.filter((r) => r.attended && heldIds.has(r.id)).length,
    total: heldIds.size,
  });
}
