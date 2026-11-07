import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { addDaysKey, pacificDayKey } from '@/lib/core/timezone';
import { isDay } from './grid';

/** A person's roles with the permissions handed to them, by user id (for a feed that has no signed-in session). */
export async function rolesOf(svc: ReturnType<typeof createServiceClient>, userId: string): Promise<RoleGrant[]> {
  const { data } = await svc.from('user_roles').select('role, division_id').eq('user_id', userId);
  return withGrantedCapabilities(data ?? [], await loadGrantedCapabilities(svc, userId).catch(() => [])) as RoleGrant[];
}

/** The signed-in person asking, with their roles, or null. */
export async function signedIn() {
  const client = await createClient();
  const {
    data: { user },
  } = await strictUser(client);
  if (!user || user.is_anonymous) return null;
  const svc = createServiceClient();
  return { user, svc, roles: await rolesOf(svc, user.id) };
}

/** ?from=&to= as Pacific days: bad or missing values become this month. */
export function rangeParams(url: URL): { from: string; to: string } {
  const today = pacificDayKey();
  const f = url.searchParams.get('from');
  const t = url.searchParams.get('to');
  const from = isDay(f) ? f : `${today.slice(0, 7)}-01`;
  const to = isDay(t) && t >= from ? t : addDaysKey(from, 41);
  return { from, to };
}
