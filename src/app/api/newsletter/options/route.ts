import { NextResponse } from 'next/server';
import { authorizeNewsletter } from '@/lib/newsletter/server';

export const dynamic = 'force-dynamic';

// What the editor's pickers choose from: recent events, divisions and saved teams.
export async function GET() {
  const auth = await authorizeNewsletter('write');
  if (auth.error) return auth.error;
  const [{ data: events }, { data: divisions }, { data: teams }] = await Promise.all([
    auth.svc.from('events').select('id, title, start_date, is_published').order('start_date', { ascending: false }).limit(80),
    auth.svc.from('divisions').select('id, name').order('name'),
    auth.svc.from('meeting_groups').select('id, name, member_ids').order('name'),
  ]);
  return NextResponse.json({
    events: events ?? [],
    divisions: divisions ?? [],
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name, size: ((t.member_ids as string[] | null) ?? []).length })),
  });
}
