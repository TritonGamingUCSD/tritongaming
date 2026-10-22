import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { GAME_OPTIONS } from '@/lib/site/games';
import { OPTION_KINDS, type OptionKind } from '@/lib/logistics/constants';
import { pacificToday } from '@/lib/logistics/planServer';

export const dynamic = 'force-dynamic';

const DEVICE_COLUMNS = 'id, tag, name, type, shelf, tier, place_note, condition, ports, login, games, kit, quantity, quantity_is_estimate, notes, created_at, updated_at';

// Everything the Logistics screen needs in ONE request (the catalog, the dropdown lists, the sponsors, and the names of loaner owners), so opening the section costs a single
// function call and four small reads. After this the screen applies each edit's reply itself instead of reloading.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const [devices, options, sponsors, today] = await Promise.all([
    auth.svc.from('logistics_devices').select(DEVICE_COLUMNS).order('tag_key', { nullsFirst: false }).limit(5000),
    auth.svc.from('logistics_options').select('id, kind, value, sort, meta').order('sort').order('value').limit(2000),
    auth.svc.from('logistics_sponsors').select('id, name, contact, notes').order('name').limit(500),
    // Plans happening today, for the banner at the top.
    auth.svc.from('logistics_plans').select('id, slug, name').eq('status', 'draft').lte('starts_on', pacificToday()).gte('ends_on', pacificToday()).order('starts_on').limit(5),
  ]);
  if (devices.error || options.error || sponsors.error) return NextResponse.json({ error: 'Couldn’t load Event Logistics.' }, { status: 500 });
  type Item = { id: string; value: string; counted?: boolean; main?: boolean; applies?: string; kit?: boolean; gives?: boolean; leftover?: boolean; items?: unknown };
  const lists = Object.fromEntries(OPTION_KINDS.map((k) => [k, [] as Item[]])) as Record<OptionKind, Item[]>;
  for (const o of options.data ?? []) {
    const m = (o.meta ?? {}) as { counted?: boolean; main?: boolean; applies?: string; kit?: boolean; gives?: boolean; leftover?: boolean; items?: unknown };
    lists[o.kind as OptionKind]?.push({ id: o.id as string, value: o.value as string, ...(o.kind === 'type' ? { counted: !!m.counted, main: !!m.main } : {}), ...(o.kind === 'step' ? { applies: m.applies ?? 'all', kit: !!m.kit } : {}), ...(o.kind === 'prize_step' ? { gives: !!m.gives, leftover: !!m.leftover } : {}), ...(o.kind === 'bundle' ? { items: m.items ?? [] } : {}) });
  }
  return NextResponse.json({
    canManage: auth.canManage,
    isAdmin: auth.roles.some((r) => r.role === 'admin'),   // only the Admin role may use the phone/laptop preview
    lists,
    portalGames: GAME_OPTIONS,
    devices: devices.data ?? [],
    sponsors: sponsors.data ?? [],
    todayPlans: today.data ?? [],
  });
}
