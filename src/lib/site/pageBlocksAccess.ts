import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { rolesOf } from '@/lib/calendar/auth';
import { canActInDivision } from '@/lib/portal/divisionAccess';
import { canManageEvent } from '@/lib/events/eventAccess';

export type PageKind = 'event' | 'division';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const pageKind = (v: unknown): PageKind | null => (v === 'event' || v === 'division' ? v : null);
export const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Who may edit the blocks of this event or division: the same people who may save the page (an event's managers; a division's Heads, exec and admin). Returns the person and a server client, or the refusal. */
export async function authorizePageBlocks(kind: PageKind, id: string) {
  const user = (await strictUser(await createClient())).data.user;
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const svc = createServiceClient();
  const roles = await rolesOf(svc, user.id);
  let allowed = false;
  if (kind === 'division') {
    const { data } = await svc.from('divisions').select('id').eq('id', id).maybeSingle();
    if (!data) return { error: NextResponse.json({ error: 'No such division.' }, { status: 404 }) };
    allowed = canActInDivision(roles, id, 'head');
  } else {
    const { data } = await svc.from('events').select('id, division_id').eq('id', id).maybeSingle();
    if (!data) return { error: NextResponse.json({ error: 'No such event.' }, { status: 404 }) };
    allowed = canManageEvent(roles, { division_id: (data.division_id as string | null) ?? null });
  }
  if (!allowed) return { error: NextResponse.json({ error: 'You cannot edit this page.' }, { status: 403 }) };
  return { user, svc };
}
