import { NextResponse } from 'next/server';
import { authorizeStrikes, trackedPeople } from '@/lib/strikes';
import { markLabels } from '@/lib/strikeLabels';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// One person's whole record, for exec and HR: every strike (with who did what), every voucher, and the history with each reason.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const person = (await trackedPeople(auth.svc)).find((p) => p.id === id);
  if (!person) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const [{ data: s }, { data: v }, { data: ev }] = await Promise.all([
    auth.svc.from('strikes').select('*').eq('user_id', id).order('incident_date', { ascending: false }).order('created_at', { ascending: false }),
    auth.svc.from('strike_vouchers').select('id, reason, created_at, used_at, used_on_strike_id, created_by, removed_at, removed_by, removed_reason').eq('user_id', id).order('created_at', { ascending: false }),
    auth.svc.from('strike_events').select('id, kind, label, reason, actor_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
  ]);
  const strikeIds = (s ?? []).map((x) => x.id as string);
  const { data: asks } = strikeIds.length ? await auth.svc.from('strike_disputes').select('id, strike_id, message, created_at, resolved_at').in('strike_id', strikeIds).order('created_at', { ascending: false }) : { data: [] as { id: string; strike_id: string; message: string; created_at: string; resolved_at: string | null }[] };
  const actors = [...new Set([...(s ?? []).flatMap((x) => [x.created_by, x.published_by, x.removed_by]), ...(v ?? []).flatMap((x) => [x.created_by, x.removed_by]), ...(ev ?? []).map((x) => x.actor_id)].filter((x): x is string => !!x))];
  const { data: ps } = actors.length ? await auth.svc.from('profiles').select('id, display_name').in('id', actors) : { data: [] as { id: string; display_name: string | null }[] };
  const name = new Map((ps ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Someone']));
  const marks = markLabels((s ?? []).filter((x) => x.status === 'published').reverse() as { id: string }[]);
  const who = (uid: unknown) => (uid ? name.get(uid as string) ?? 'Someone' : null);
  return NextResponse.json({
    person, isMe: id === auth.user.id,
    strikes: (s ?? []).map((x) => ({ id: x.id, status: x.status, mark: marks.get(x.id as string) ?? null, category: x.category, questions: (asks ?? []).filter((a) => a.strike_id === x.id).map((a) => ({ id: a.id, message: a.message, created_at: a.created_at, resolved_at: a.resolved_at })), reason: x.reason, incident_date: x.incident_date, meeting_id: x.meeting_id, created_at: x.created_at, published_at: x.published_at, removed_at: x.removed_at, removed_how: x.removed_how, removed_note: x.removed_note, created_by: who(x.created_by), published_by: who(x.published_by), removed_by: who(x.removed_by) })),
    vouchers: (v ?? []).map((x) => ({ id: x.id, reason: x.reason, created_at: x.created_at, used_at: x.used_at, used_on_strike_id: x.used_on_strike_id, given_by: who(x.created_by), removed_at: x.removed_at, removed_by: who(x.removed_by), removed_reason: x.removed_reason })),
    events: (ev ?? []).map((x) => ({ id: x.id, kind: x.kind, label: x.label, reason: x.reason, by: who(x.actor_id), at: x.created_at })),
  });
}
