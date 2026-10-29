import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';

// Who may use Logistics: 'view' (recruits, officers and above, plus anyone who manages it) or 'manage' (the Logistics permission: exec and admin, or granted in Admin → Access).
// Read from the roles directly, never from anything check-in related.
export async function authorizeLogistics(mode: 'view' | 'manage' | 'request') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const canManage = hasCapability(grants, 'manage_logistics');
  const canView = canManage || hasCapability(grants, 'view_logistics');
  const canRequest = canView || hasCapability(grants, 'request_logistics'); // a division account may only send and read requests
  if (mode === 'manage' ? !canManage : mode === 'view' ? !canView : !canRequest) {
    return {
      error: NextResponse.json(
        { error: mode === 'manage' ? 'Only people with the Event Logistics permission can change this.' : 'Event Logistics is for recruits, officers and above.' },
        { status: 403 },
      ),
    };
  }
  return { user, svc, roles: grants, canManage, canView };
}
