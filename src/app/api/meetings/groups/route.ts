import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { cleanMemberIds as cleanMembers } from '@/lib/meetingAudience';
import { authorizeMeetings, authorizeTeamView } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await authorizeTeamView();
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('meeting_groups').select('id, name, member_ids, created_by').order('name');
  return NextResponse.json({ groups: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 60);
  const members = cleanMembers(b.member_ids);
  if (!name) return NextResponse.json({ error: 'Give the group a name.' }, { status: 400 });
  if (!members || members.length === 0) return NextResponse.json({ error: 'Pick at least one person.' }, { status: 400 });
  const { data, error } = await auth.svc.from('meeting_groups').insert({ name, member_ids: members, created_by: auth.user.id }).select('id, name, member_ids').single();
  if (error) return NextResponse.json({ error: 'Failed to save the group.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'meeting group', entityId: data.id, summary: `Created meeting group "${name}" (${members.length} people)` });
  return NextResponse.json({ group: data }, { status: 201 });
}
