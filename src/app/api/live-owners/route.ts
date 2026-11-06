import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { liveScope } from '@/lib/divisions/liveAccess';

export const dynamic = 'force-dynamic';

// Who a new poll, quiz, Q&A or booth can be made for by this person: the club (if they run its Live Tools) and each division they are a Member or Head of (every division, for exec and admin).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const scope = liveScope(grants);
  const { data: all } = await svc.from('divisions').select('id, name').order('name');
  const divLiveOff = (await getOffSwitches()).includes('div_live');
  const divisions = (divLiveOff ? [] : (all ?? []))
    .filter((d) => scope.staff || scope.divisions.includes(d.id as string))
    .map((d) => ({ id: d.id as string, name: d.name as string }));
  return NextResponse.json({ tg: scope.tg, divisions });
}
