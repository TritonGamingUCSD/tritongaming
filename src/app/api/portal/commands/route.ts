import { NextResponse } from 'next/server';
import { getUserRoles, getUser } from '@/lib/auth';
import { commandsFor } from '@/lib/portalCommands';

export const dynamic = 'force-dynamic';

// The sections and actions this person can jump to from the search bar (respects "View as" and granted access).
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ commands: commandsFor(await getUserRoles()) });
}
