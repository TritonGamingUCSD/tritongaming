import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { cleanDevice, tagKey } from '@/lib/logistics/devices';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, tag, name, type, shelf, tier, place_note, condition, ports, login, games, kit, quantity, quantity_is_estimate, notes, created_at, updated_at';

// Add a device. Individual types need an ID (and it must be new: TECM1 and "tecm 1" are the same); counted types (cables, power strips) don't.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { value, error } = cleanDevice(await request.json().catch(() => ({})));
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!value.type) return NextResponse.json({ error: 'Pick what kind of device it is.' }, { status: 400 });
  const { data: t } = await auth.svc.from('logistics_options').select('meta').eq('kind', 'type').ilike('value', value.type).maybeSingle();
  const counted = !!(t?.meta as { counted?: boolean } | null)?.counted;
  if (!counted && !value.tag) return NextResponse.json({ error: 'Type the ID that is written on it (for example TECM1).' }, { status: 400 });
  if (value.tag) {
    const { data: clash } = await auth.svc.from('logistics_devices').select('tag').eq('tag_key', tagKey(value.tag)).maybeSingle();
    if (clash) return NextResponse.json({ error: `${clash.tag} already exists.` }, { status: 409 });
  }
  const { data, error: dbError } = await auth.svc.from('logistics_devices').insert({ ...value, created_by: auth.user.id }).select(COLUMNS).single();
  if (dbError || !data) return NextResponse.json({ error: dbError?.code === '23505' ? 'That ID already exists.' : 'Couldn’t save it.' }, { status: dbError?.code === '23505' ? 409 : 500 });
  await auth.svc.from('logistics_device_log').insert({ device_id: data.id, actor_id: auth.user.id, kind: 'created', summary: 'Added to the catalog' });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'logistics device', entityId: data.id as string, summary: `Added ${data.tag ?? data.type} to the equipment catalog` });
  return NextResponse.json({ device: data }, { status: 201 });
}
