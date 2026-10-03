import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeStrikes, notYourOwn, notifyPerson } from '@/lib/strikes';

const UUID = /^[0-9a-f-]{36}$/i;

// HR marks a question as dealt with (never one about themselves).
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeStrikes('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: d } = await auth.svc.from('strike_disputes').select('id, user_id, resolved_at').eq('id', id).maybeSingle();
  if (!d) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (d.user_id === auth.user.id) return notYourOwn();
  if (d.resolved_at) return NextResponse.json({ ok: true });
  await auth.svc.from('strike_disputes').update({ resolved_at: new Date().toISOString(), resolved_by: auth.user.id }).eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'resolve', entityType: 'strike question', entityId: id, summary: 'Marked a strike question as dealt with' });
  await notifyPerson(auth.svc, d.user_id as string, 'HR looked at your question', 'Open your Profile, under Strikes.');
  return NextResponse.json({ ok: true });
}
