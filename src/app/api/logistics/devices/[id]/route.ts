import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { cleanDevice, describeChange, tagKey, type Device } from '@/lib/logistics/devices';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;
const COLUMNS = 'id, tag, name, type, shelf, tier, place_note, condition, owner_type, owner_user_id, sponsor_id, owner_note, ports, login, games, kit, quantity, quantity_is_estimate, notes, created_at, updated_at';

// The history of one device (fetched only when someone opens it).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data } = await auth.svc.from('logistics_device_log').select('id, at, actor_id, kind, summary').eq('device_id', id).order('at', { ascending: false }).limit(100);
  const ids = [...new Set((data ?? []).map((l) => l.actor_id as string | null).filter((x): x is string => !!x))];
  const { data: people } = ids.length ? await auth.svc.from('profiles').select('id, display_name').in('id', ids) : { data: [] as { id: string; display_name: string | null }[] };
  const names = new Map((people ?? []).map((p) => [p.id as string, p.display_name || 'Unnamed']));
  return NextResponse.json({ log: (data ?? []).map((l) => ({ id: l.id, at: l.at, kind: l.kind, summary: l.summary, by: l.actor_id ? names.get(l.actor_id as string) ?? 'Someone' : null })) });
}

// Change a device (only the fields sent). Every meaningful change is written to its history.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { value, error } = cleanDevice(await request.json().catch(() => ({})));
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (Object.keys(value).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  const { data: before } = await auth.svc.from('logistics_devices').select(COLUMNS).eq('id', id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'That device is gone.' }, { status: 404 });
  const type = value.type ?? (before.type as string);
  const { data: t } = await auth.svc.from('logistics_options').select('meta').eq('kind', 'type').ilike('value', type).maybeSingle();
  const counted = !!(t?.meta as { counted?: boolean } | null)?.counted;
  const nextTag = 'tag' in value ? value.tag ?? null : (before.tag as string | null);
  if (!counted && !nextTag) return NextResponse.json({ error: 'A device needs the ID written on it.' }, { status: 400 });
  if ('tag' in value && value.tag) {
    const { data: clash } = await auth.svc.from('logistics_devices').select('id, tag').eq('tag_key', tagKey(value.tag)).neq('id', id).maybeSingle();
    if (clash) return NextResponse.json({ error: `${clash.tag} already exists.` }, { status: 409 });
  }
  const { data: after, error: dbError } = await auth.svc.from('logistics_devices').update({ ...value, updated_at: new Date().toISOString() }).eq('id', id).select(COLUMNS).single();
  if (dbError || !after) return NextResponse.json({ error: dbError?.code === '23505' ? 'That ID already exists.' : 'Couldn’t save it.' }, { status: dbError?.code === '23505' ? 409 : 500 });
  const lines = describeChange(before as unknown as Device, after as unknown as Device);
  if (lines.length) await auth.svc.from('logistics_device_log').insert(lines.map((l) => ({ device_id: id, actor_id: auth.user.id, kind: l.kind, summary: l.summary })));
  return NextResponse.json({ device: after });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: d } = await auth.svc.from('logistics_devices').select('tag, type').eq('id', id).maybeSingle();
  if (!d) return NextResponse.json({ ok: true });
  const { error } = await auth.svc.from('logistics_devices').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Couldn’t remove it.' }, { status: 500 });
  // 'remove', not 'delete': the audit log tells every admin about a "delete", and taking a cable off a list is not worth a phone buzz.
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics device', entityId: id, summary: `Removed ${d.tag ?? d.type} from the equipment catalog` });
  return NextResponse.json({ ok: true });
}
