import { NextResponse } from 'next/server';
import { authorizeNewspaper } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

// Find people by name for the audience's "add a person" and "leave out" pickers: GET ?q=sam (at least 2 letters) → up to 15 matches. ?ids=a,b gives the names of people already picked.
export async function GET(request: Request) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const ids = (params.get('ids') ?? '')
    .split(',')
    .filter((x) => /^[0-9a-f-]{36}$/i.test(x))
    .slice(0, 200);
  if (ids.length) {
    const { data } = await auth.svc.from('profiles').select('id, display_name').in('id', ids);
    return NextResponse.json({ people: (data ?? []).map((p) => ({ id: p.id, name: p.display_name || 'Someone' })) });
  }
  const q = (params.get('q') ?? '')
    .trim()
    .replace(/[%_,()]/g, ' ')
    .slice(0, 40);
  if (q.length < 2) return NextResponse.json({ people: [] });
  const { data } = await auth.svc.from('profiles').select('id, display_name').ilike('display_name', `%${q}%`).order('display_name').limit(15);
  return NextResponse.json({ people: (data ?? []).map((p) => ({ id: p.id, name: p.display_name || 'Someone' })) });
}
