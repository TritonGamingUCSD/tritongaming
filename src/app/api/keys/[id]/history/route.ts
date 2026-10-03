import { NextResponse } from 'next/server';
import { authorizeKeys, keyPeople } from '@/lib/storageKeys';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

// Where a key has been: the latest moves, newest first.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeKeys('view_keys');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
  const { data } = await auth.svc.from('storage_key_events').select('*').eq('key_id', id).order('at', { ascending: false }).limit(40);
  const ids = [...new Set((data ?? []).flatMap((e) => [e.actor_id, e.from_user_id, e.to_user_id]).filter((x): x is string => !!x))];
  const names = new Map((await keyPeople(auth.svc)).map((p) => [p.id, p.name]));
  const missing = ids.filter((x) => !names.has(x));
  if (missing.length) { const { data: ps } = await auth.svc.from('profiles').select('id, display_name').in('id', missing); for (const p of ps ?? []) names.set(p.id as string, (p.display_name as string | null) || 'Unnamed'); }
  const nm = (uid: string | null, label: string | null, kind: string | null) => (kind === 'member' ? (uid ? names.get(uid) ?? 'Unknown member' : 'Unknown') : kind === 'person' || kind === 'place' ? (label ?? '') : null);
  return NextResponse.json({
    events: (data ?? []).map((e) => ({
      id: e.id, at: e.at, kind: e.kind, note: e.note,
      actor: e.actor_id ? names.get(e.actor_id as string) ?? 'Someone' : 'Someone',
      // Who it was with and who it went to, plainly (kind says whether that is a member, an outsider or a place), and whether the person
      // who recorded the move was the one who had the key, so the page can say "Eric gave it to Jasper" rather than a from/to record.
      fromKind: e.from_kind, from: nm(e.from_user_id, e.from_label, e.from_kind),
      toKind: e.to_kind, to: nm(e.to_user_id, e.to_label, e.to_kind),
      actorIsFrom: !!e.actor_id && e.actor_id === e.from_user_id,
    })),
  });
}
