import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';

export const dynamic = 'force-dynamic';

// The officers to choose from for an officer loaner. Fetched only when the picker is opened (not with the catalog), and only names and ids.
export async function GET() {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { data: roles } = await auth.svc.from('user_roles').select('user_id').in('role', ['officer', 'division', 'lead', 'exec', 'admin']);
  const ids = [...new Set((roles ?? []).map((r) => r.user_id as string))];
  if (!ids.length) return NextResponse.json({ people: [] });
  const { data } = await auth.svc.from('profiles').select('id, display_name').in('id', ids).order('display_name').limit(1000);
  return NextResponse.json({ people: (data ?? []).map((p) => ({ id: p.id as string, name: (p.display_name as string | null) || 'Unnamed' })) });
}
