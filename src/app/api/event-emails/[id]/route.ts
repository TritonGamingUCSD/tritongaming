import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { isEmailKind, type EmailKind } from '@/lib/email/prefs';
import { authorizeEventEmail, sendBatch } from '@/lib/email/eventEmailServer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const UUID = /^[0-9a-f-]{36}$/i;

// Sends the next batch of a recorded send: { from } is how many people have been handled so far. The page calls this again until `done`.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorizeEventEmail();
  if (a.error) return a.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const from = Math.max(0, Math.floor(Number(b.from) || 0));
  const { data: row } = await a.svc.from('event_emails').select('id, event_id, kind, subject, note, cover, recipients, sent, failed').eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'That send is gone.' }, { status: 404 });
  if (from !== (row.sent as number) + (row.failed as number)) return NextResponse.json({ error: 'That send has moved on. Reload the page.' }, { status: 409 });
  if (from >= (row.recipients as number)) return NextResponse.json({ done: true, next: from, total: row.recipients, sent: 0, failed: 0 });
  if (!isEmailKind(row.kind)) return NextResponse.json({ error: 'Bad kind.' }, { status: 400 });
  const r = await sendBatch(a.svc, { id, event_id: row.event_id as string, kind: row.kind as EmailKind, subject: row.subject as string, note: row.note as string | null, cover: row.cover !== false }, from);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 404 });
  if (r.done) {
    const { data: end } = await a.svc.from('event_emails').select('sent, failed, recipients').eq('id', id).maybeSingle();
    await logAudit(a.svc, { actorId: a.user.id, action: 'event_email.finish', entityType: 'event', entityId: row.event_id as string, summary: `Finished sending “${String(row.subject).slice(0, 80)}”: ${end?.sent ?? '?'} sent, ${end?.failed ?? 0} failed of ${end?.recipients ?? row.recipients}` }).catch(() => undefined);
  }
  return NextResponse.json(r);
}
