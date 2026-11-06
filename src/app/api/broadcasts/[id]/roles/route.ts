import { NextResponse } from 'next/server';
import { broadcaster } from '@/lib/broadcast/server';
import { BROADCAST_ROLES } from '@/lib/broadcast/config';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

// Give someone a role on a broadcast: { role, user_id? | name? }. Delete takes { id }.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await broadcaster();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { role?: string; user_id?: string; name?: string };
  const role = String(b.role ?? '')
    .trim()
    .slice(0, 40);
  if (!role) return NextResponse.json({ error: 'Pick a role.' }, { status: 400 });
  const blocked = await refuseBlocked({ Name: b.name });
  if (blocked) return blocked;
  if (!b.user_id && !String(b.name ?? '').trim()) return NextResponse.json({ error: 'Say who.' }, { status: 400 });
  void BROADCAST_ROLES;
  const { error } = await a.svc.from('broadcast_roles').insert({
    broadcast_id: id,
    role,
    user_id: b.user_id || null,
    name: String(b.name ?? '')
      .trim()
      .slice(0, 60),
  });
  if (error) return NextResponse.json({ error: 'Could not add them.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await broadcaster();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  await a.svc
    .from('broadcast_roles')
    .delete()
    .eq('id', b.id ?? '')
    .eq('broadcast_id', id);
  return NextResponse.json({ ok: true });
}
