import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { GAME_OPTIONS } from '@/lib/site/games';
import { OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';

export const dynamic = 'force-dynamic';

const DEVICE_COLUMNS = 'id, tag, name, type, shelf, tier, place_note, condition, owner_type, owner_user_id, sponsor_id, owner_note, ports, login, games, kit, quantity, quantity_is_estimate, notes, created_at, updated_at';

// Everything the Logistics screen needs in ONE request (the catalog, the dropdown lists, the sponsors, and the names of loaner owners), so opening the section costs a single
// function call and four small reads. After this the screen applies each edit's reply itself instead of reloading.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const [devices, options, sponsors] = await Promise.all([
    auth.svc.from('logistics_devices').select(DEVICE_COLUMNS).order('tag_key', { nullsFirst: false }).limit(5000),
    auth.svc.from('logistics_options').select('id, kind, value, sort, meta').order('sort').order('value').limit(2000),
    auth.svc.from('logistics_sponsors').select('id, name, contact, notes').order('name').limit(500),
  ]);
  if (devices.error || options.error || sponsors.error) return NextResponse.json({ error: 'Couldn’t load Logistics.' }, { status: 500 });
  const lists = Object.fromEntries(OPTION_KINDS.map((k) => [k, [] as { id: string; value: string; counted?: boolean }[]])) as Record<OptionKind, { id: string; value: string; counted?: boolean }[]>;
  for (const o of options.data ?? []) lists[o.kind as OptionKind]?.push({ id: o.id as string, value: o.value as string, ...(o.kind === 'type' ? { counted: !!(o.meta as { counted?: boolean } | null)?.counted } : {}) });
  const ownerIds = [...new Set((devices.data ?? []).map((d) => d.owner_user_id as string | null).filter((x): x is string => !!x))];
  const { data: people } = ownerIds.length ? await auth.svc.from('profiles').select('id, display_name').in('id', ownerIds) : { data: [] as { id: string; display_name: string | null }[] };
  return NextResponse.json({
    canManage: auth.canManage,
    lists,
    portalGames: GAME_OPTIONS,
    devices: devices.data ?? [],
    sponsors: sponsors.data ?? [],
    owners: Object.fromEntries((people ?? []).map((p) => [p.id, p.display_name || 'Unnamed'])),
  });
}
