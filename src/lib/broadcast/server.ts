import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { canActInDivision } from '@/lib/portal/divisionAccess';
import { guardFeature } from '@/lib/portal/featureGuard';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { BROADCAST_ADMIN_ONLY, channelKeys } from './config';

// The person asking, with what they may do. The club's broadcasts (no division) are admin-only for now; a division's own broadcasts belong to that division: its Heads run them and its Members can see the schedule and their roles.
// `canManage` says whether they may change things. `write: false` lets a division Member through to read. Answers the error response to return otherwise.
export async function broadcaster(divisionId: string | null = null, write = true) {
  const off = await guardFeature('broadcast');
  if (off) return { error: off } as const;
  if (divisionId && (await getOffSwitches()).includes('div_broadcast'))
    return { error: NextResponse.json({ error: 'Broadcasts for divisions are switched off.' }, { status: 403 }) } as const;
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) } as const;
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => [])) as RoleGrant[];
  const staff = hasCapability(roles, 'manage_broadcast') || (!BROADCAST_ADMIN_ONLY && roles.some((r) => r.role === 'exec'));
  const canManage = divisionId ? staff || canActInDivision(roles, divisionId, 'head') : staff;
  const canSee = canManage || (!!divisionId && canActInDivision(roles, divisionId, 'member'));
  if (!(write ? canManage : canSee))
    return {
      error: NextResponse.json({ error: divisionId ? 'Only the division’s Heads can change its broadcasts.' : 'Broadcast is not open to you yet.' }, { status: 403 }),
    } as const;
  return { user, svc, roles, canManage, divisionId } as const;
}

/** Same, for an existing broadcast: whose it is decides who may touch it. */
export async function broadcasterFor(broadcastId: string, write = true) {
  const { data } = await createServiceClient().from('broadcasts').select('division_id').eq('id', broadcastId).maybeSingle();
  if (!data) return { error: NextResponse.json({ error: 'No such broadcast.' }, { status: 404 }) } as const;
  return broadcaster((data.division_id as string | null) ?? null, write);
}

export async function loadChannels(svc = createServiceClient(), divisionId: string | null = null) {
  const keys = channelKeys(divisionId);
  const { data } = await svc.from('team_settings').select('key, value').in('key', [keys.twitch, keys.youtube]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value ?? '';
  return { twitch: get(keys.twitch) as string, youtube: get(keys.youtube) as string };
}
