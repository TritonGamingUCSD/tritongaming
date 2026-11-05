import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { canActInDivision } from '@/lib/portal/divisionAccess';
import { canCheckInEvent, canManageEvent } from '@/lib/events/eventAccess';

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

// `eventId`: the event the workspace is for. A division's event has its own rules (its Heads edit it, its Members and Heads run check-in and the Live Tools; nothing of Logistics, email or Staffle); Triton Gaming's
// events follow the club's permissions as always.
export async function authorizeWorkspace(eventId?: string) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants: RoleGrant[] = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  let ownerDivision: string | null = null;
  if (eventId && UUID.test(eventId))
    ownerDivision = ((await svc.from('events').select('division_id').eq('id', eventId).maybeSingle()).data?.division_id as string | null | undefined) ?? null;
  const owner = { division_id: ownerDivision };
  const caps: WorkspaceCaps = ownerDivision
    ? {
        details: canManageEvent(grants, owner),
        tickets: canCheckInEvent(grants, owner),
        logistics: false,
        email: false,
        polls: canActInDivision(grants, ownerDivision, 'member'),
        booths: canActInDivision(grants, ownerDivision, 'member'),
        staffles: false,
      }
    : {
        details: hasCapability(grants, 'manage_events'),
        tickets: hasCapability(grants, 'checkin') || hasCapability(grants, 'manage_events'),
        logistics: hasCapability(grants, 'view_logistics'),
        email: hasCapability(grants, 'write_newsletter') || hasCapability(grants, 'send_newsletter'),
        polls: hasCapability(grants, 'host_trivia'),
        booths: hasCapability(grants, 'run_photobooth'),
        staffles: hasCapability(grants, 'view_logistics'),
      };
  if (!Object.values(caps).some(Boolean)) return { error: NextResponse.json({ error: 'The event workspace is for the team.' }, { status: 403 }) };
  return { user, svc, caps, grants };
}
