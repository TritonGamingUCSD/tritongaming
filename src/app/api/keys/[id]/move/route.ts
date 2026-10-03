import { NextResponse } from 'next/server';
import { createNotifications } from '@/lib/notify';
import { authorizeKeys, holderText, keyPeople, parseHolder, type HolderKind } from '@/lib/storageKeys';

const UUID = /^[0-9a-f-]{36}$/i;

// Say where a key is now:
//   { action: 'take' }            "I have it": the key is now with me, whoever had it before.
//   { action: 'give', to: {...} } "It was handed to ...": a member, someone outside the club, or a place.
// Anyone on the team can record either (a hand-over you saw, or a key you picked up); every move is kept with who recorded it.
// `expected_updated_at` makes sure nobody moved the key in the meantime.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeKeys('view_keys');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (b.action !== 'take' && b.action !== 'give') return NextResponse.json({ error: 'Say whether you have the key or are giving it.' }, { status: 400 });

  const { data: k } = await auth.svc.from('storage_keys').select('*').eq('id', id).maybeSingle();
  if (!k) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  if (b.expected_updated_at && new Date(b.expected_updated_at).getTime() !== new Date(k.updated_at as string).getTime()) {
    return NextResponse.json({ error: 'Someone just updated this key. Here’s where it is now.', stale: true }, { status: 409 });
  }

  const people = await keyPeople(auth.svc);
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const parsed = b.action === 'take'
    ? parseHolder({ kind: 'member', user_id: auth.user.id, note: b.note }, new Set([auth.user.id]))
    : parseHolder({ ...(b.to ?? {}), note: b.to?.note ?? b.note }, new Set(people.map((p) => p.id)));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const to = parsed.holder;
  const note = String(b.note ?? '').trim().slice(0, 200) || null;

  // Already there: nothing to record.
  const sameHolder = k.holder_kind === to.kind && (to.kind === 'member' ? k.holder_user_id === to.user_id : String(k.holder_label ?? '').toLowerCase() === String(to.label ?? '').toLowerCase());
  if (sameHolder) return NextResponse.json({ error: b.action === 'take' ? 'You already have this key.' : 'It’s already there.' }, { status: 400 });

  const now = new Date().toISOString();
  const { data: moved, error } = await auth.svc.from('storage_keys')
    .update({ holder_kind: to.kind, holder_user_id: to.user_id, holder_label: to.label, holder_note: to.note, held_since: now, updated_at: now })
    .eq('id', id).eq('updated_at', k.updated_at).select('id');
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  if (!moved?.length) return NextResponse.json({ error: 'Someone just updated this key. Here’s where it is now.', stale: true }, { status: 409 });

  const fromUser = k.holder_user_id as string | null;
  await auth.svc.from('storage_key_events').insert({
    key_id: id, at: now, actor_id: auth.user.id, kind: b.action === 'take' ? 'took' : 'gave',
    from_kind: k.holder_kind, from_user_id: fromUser, from_label: k.holder_label, to_kind: to.kind, to_user_id: to.user_id, to_label: to.label, note,
  });

  // Tell the people it affects (never the one who just recorded it): who now has it, and who had it.
  const actor = nameOf.get(auth.user.id) ?? 'Someone';
  const rows: { user_id: string; type: string; title: string; body: string; href: string }[] = [];
  const href = '/portal?section=keys';
  if (to.kind === 'member' && to.user_id !== auth.user.id) rows.push({ user_id: to.user_id!, type: 'storage_key', title: `${actor} gave you the key “${k.name}”`, body: 'It’s with you now. Tap to see all the keys.', href });
  if (fromUser && fromUser !== auth.user.id && fromUser !== to.user_id) {
    const nowWith = holderText({ kind: to.kind as HolderKind, name: to.kind === 'member' ? (nameOf.get(to.user_id!) ?? 'someone') : (to.label ?? '') });
    rows.push({ user_id: fromUser, type: 'storage_key', title: b.action === 'take' ? `${actor} says they have the key “${k.name}”` : `“${k.name}” was handed over`, body: b.action === 'take' ? 'It was listed as yours. It’s with them now.' : `${actor} recorded it as now with ${nowWith}.`, href });
  }
  if (rows.length) await createNotifications(auth.svc, rows);
  return NextResponse.json({ ok: true });
}
