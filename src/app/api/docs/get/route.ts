import { NextResponse } from 'next/server';
import { hasCapability } from '@/lib/capabilities';
import { DOC_COLUMNS, DRAFT_COLUMNS, UUID, authorizeDocs, bad } from '@/lib/docsServer';

export const dynamic = 'force-dynamic';

// One doc with its text (and, for editors, its draft). Used to refresh a page someone else changed.
export async function GET(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const canEdit = hasCapability(auth.roles, 'manage_docs');
  const { data } = await auth.svc.from('docs').select(canEdit ? `${DOC_COLUMNS}, ${DRAFT_COLUMNS}` : DOC_COLUMNS).eq('id', id).maybeSingle();
  const doc = data as unknown as { published?: boolean } | null;
  if (!doc || (!canEdit && doc.published === false)) return NextResponse.json({ error: 'This doc was deleted or moved out of reach.', code: 'deleted' }, { status: 404 });
  return NextResponse.json({ doc: { draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null, ...doc } });
}
