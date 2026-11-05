import { NextResponse } from 'next/server';
import { getUserRoles, getUser } from '@/lib/core/auth';
import { commandsFor, lockedCommandsFor } from '@/lib/portal/portalCommands';

export const dynamic = 'force-dynamic';

// The sections and actions this person can jump to from the search bar (respects "View as" and granted access).
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const roles = await getUserRoles();
  return NextResponse.json({ commands: commandsFor(roles), locked: lockedCommandsFor(roles) });
}
