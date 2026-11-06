import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { guardFeature } from '@/lib/portal/featureGuard';
import { BROADCAST_ADMIN_ONLY, CHANNEL_KEYS } from './config';

// The person asking, if they may run broadcasts (admin for now). Answers the error response to return otherwise.
export async function broadcaster() {
  const off = await guardFeature('broadcast');
  if (off) return { error: off } as const;
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) } as const;
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => [])) as RoleGrant[];
  const ok = hasCapability(roles, 'manage_broadcast') || (!BROADCAST_ADMIN_ONLY && roles.some((r) => r.role === 'exec'));
  if (!ok) return { error: NextResponse.json({ error: 'Broadcast is not open to you yet.' }, { status: 403 }) } as const;
  return { user, svc, roles } as const;
}

export async function loadChannels(svc = createServiceClient()) {
  const { data } = await svc.from('team_settings').select('key, value').in('key', [CHANNEL_KEYS.twitch, CHANNEL_KEYS.youtube]);
  const get = (k: string) => (data ?? []).find((r) => r.key === k)?.value ?? '';
  return { twitch: get(CHANNEL_KEYS.twitch) as string, youtube: get(CHANNEL_KEYS.youtube) as string };
}
