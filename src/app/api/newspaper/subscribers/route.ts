import { NextResponse } from 'next/server';
import { authorizeNewspaper } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

// The public subscribers (senders only): counts, and the people (newest first; ?q= searches the address or name).
export async function GET(request: Request) {
  const auth = await authorizeNewspaper('send');
  if (auth.error) return auth.error;
  const q = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .replace(/[%_,()]/g, ' ')
    .slice(0, 60);
  let query = auth.svc.from('newspaper_subscribers').select('id, email, name, status, created_at, confirmed_at').order('created_at', { ascending: false }).limit(300);
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  const [{ data }, ...counts] = await Promise.all([
    query,
    ...(['active', 'pending', 'unsubscribed'] as const).map((s) => auth.svc.from('newspaper_subscribers').select('id', { count: 'exact', head: true }).eq('status', s)),
  ]);
  return NextResponse.json({ subscribers: data ?? [], active: counts[0].count ?? 0, pending: counts[1].count ?? 0, unsubscribed: counts[2].count ?? 0 });
}
