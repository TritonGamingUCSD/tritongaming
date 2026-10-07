import { NextResponse } from 'next/server';
import { staffName } from '@/lib/members/names';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';
const ACTIVE_MS = 60_000;

// A heartbeat from an open editor: { id, leaving? }. Answers with who ELSE has this doc open right now, so two people can see each other.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  if (b.leaving) {
    await auth.svc.from('doc_editing').delete().eq('doc_id', id).eq('user_id', auth.user.id);
    return NextResponse.json({ others: [] });
  }
  await auth.svc.from('doc_editing').upsert({ doc_id: id, user_id: auth.user.id, last_seen: new Date().toISOString() }, { onConflict: 'doc_id,user_id' });
  const { data } = await auth.svc.from('doc_editing').select('user_id').eq('doc_id', id).neq('user_id', auth.user.id).gte('last_seen', new Date(Date.now() - ACTIVE_MS).toISOString());
  const ids = (data ?? []).map((r) => r.user_id as string);
  const { data: ps } = ids.length ? await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', ids) : { data: [] as Record<string, unknown>[] };
  return NextResponse.json({ others: (ps ?? []).map((p) => staffName(p as never)) });
}
