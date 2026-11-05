import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';

export const UUID = /^[0-9a-f-]{36}$/i;

// Who sees what in an event's workspace: each tab and each kind of live tool has its own permission, so a person gets only the tabs they could already reach as separate pages.
export interface WorkspaceCaps {
  details: boolean; // edit the event
  tickets: boolean; // who registered, check-ins
  logistics: boolean;
  email: boolean;
  polls: boolean; // polls, Q&A and Trivia (the Trivia permission)
  booths: boolean;
  staffles: boolean;
}

export async function authorizeWorkspace() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants: RoleGrant[] = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  const caps: WorkspaceCaps = {
    details: hasCapability(grants, 'manage_events'),
    tickets: hasCapability(grants, 'checkin') || hasCapability(grants, 'manage_events'),
    logistics: hasCapability(grants, 'view_logistics'),
    email: hasCapability(grants, 'write_newspaper') || hasCapability(grants, 'send_newspaper'),
    polls: hasCapability(grants, 'host_trivia'),
    booths: hasCapability(grants, 'run_photobooth'),
    staffles: hasCapability(grants, 'view_logistics'),
  };
  if (!Object.values(caps).some(Boolean)) return { error: NextResponse.json({ error: 'The event workspace is for the team.' }, { status: 403 }) };
  return { user, svc, caps, grants };
}
