import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeNewspaper } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

// Remove a subscriber for good (senders only), for someone who asks to be taken off by hand.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeNewspaper('send');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ ok: true });
  await auth.svc.from('newspaper_subscribers').delete().eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'newspaper', entityId: id, summary: 'Removed a Newspaper subscriber' });
  return NextResponse.json({ ok: true });
}
