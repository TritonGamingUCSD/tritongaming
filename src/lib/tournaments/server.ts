import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { guardFeature } from '@/lib/portal/featureGuard';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { canManageTournament, canRunTournament } from './access';
import { loadTournament } from './store';

// Shared by the tournament routes: who is asking, their roles, and the tournament they mean with what they may do to it.
export async function who() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return null;
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => [])) as RoleGrant[];
  return { user, svc, roles };
}

export const unauthorized = () => NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

// For a tournament and a person: `level` says how much they may do. Answers with the loaded data, or the error response to return.
export async function withTournament(id: string, need: 'manage' | 'run' | 'view' | 'claim') {
  const me = await who();
  if (need !== 'view' && need !== 'claim' && !me) return { error: unauthorized() } as const;
  const svc = me?.svc ?? createServiceClient();
  const data = await loadTournament(svc, id);
  if (!data) return { error: NextResponse.json({ error: 'No such tournament.' }, { status: 404 }) } as const;
  const off = await getOffSwitches();
  if (off.includes('tournaments') || (data.tournament.division_id && off.includes('div_tournaments'))) {
    return { error: NextResponse.json({ error: 'Tournaments are turned off right now.' }, { status: 403 }) } as const;
  }
  const roles = me?.roles ?? [];
  const isStaff = !!me && data.staff.includes(me.user.id);
  const manage = canManageTournament(roles, data.tournament, isStaff);
  const run = canRunTournament(roles, data.tournament, isStaff);
  if (need === 'manage' && !manage) return { error: NextResponse.json({ error: 'Only this tournament’s organizers can do that.' }, { status: 403 }) } as const;
  if (need === 'run' && !run) return { error: NextResponse.json({ error: 'You cannot enter scores for this tournament.' }, { status: 403 }) } as const;
  if (need === 'view' && !manage && !run && (data.tournament.status === 'draft' || !data.tournament.is_public))
    return { error: NextResponse.json({ error: 'No such tournament.' }, { status: 404 }) } as const;
  return { me, svc, ...data, manage, run } as const;
}

export { guardFeature };
