import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { KEY_COLORS, authorizeKeys, keyPeople, listKeys, parseHolder } from '@/lib/storage/storageKeys';

export const dynamic = 'force-dynamic';

// Every key, where it is, and the people a key can be handed to.
export async function GET() {
  const auth = await authorizeKeys('view_keys');
  if (auth.error) return auth.error;
  const people = await keyPeople(auth.svc);
  return NextResponse.json({ keys: await listKeys(auth.svc, auth.user, auth.manageAll, people), people, me: auth.user.id, colors: KEY_COLORS, canManage: auth.manageAll });
}

// Add a key (exec and admin). It starts out with whoever the creator says has it (by default, the creator).
export async function POST(request: Request) {
  const auth = await authorizeKeys('manage_keys');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: 'Give the key a name.' }, { status: 400 });
  const color = (KEY_COLORS as readonly string[]).includes(b.color) ? b.color : KEY_COLORS[0];
  const people = await keyPeople(auth.svc);
  const parsed = parseHolder(b.holder ?? { kind: 'member', user_id: auth.user.id }, new Set(people.map((p) => p.id)));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const h = parsed.holder;
  const { data, error } = await auth.svc.from('storage_keys').insert({ name, color, holder_kind: h.kind, holder_user_id: h.user_id, holder_label: h.label, holder_note: h.note, created_by: auth.user.id }).select('id').single();
  if (error || !data) return NextResponse.json({ error: 'Failed to add the key.' }, { status: 500 });
  await auth.svc.from('storage_key_events').insert({ key_id: data.id, actor_id: auth.user.id, kind: 'created', to_kind: h.kind, to_user_id: h.user_id, to_label: h.label, note: h.note });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'storage key', entityId: data.id, summary: `Added the key "${name}"` });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
