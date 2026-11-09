import { NextResponse } from 'next/server';
import { cleanBlocks } from '@/lib/site/pageBlocks';
import { authorizePageBlocks, isId, pageKind } from '@/lib/site/pageBlocksAccess';

export const dynamic = 'force-dynamic';

// The blocks of one earlier version, to load into the editor (it is only published when the page is saved). ?type=event|division&id=<page id>
export async function GET(request: Request, { params }: { params: Promise<{ vid: string }> }) {
  const { vid } = await params;
  const q = new URL(request.url).searchParams;
  const kind = pageKind(q.get('type'));
  const id = q.get('id');
  if (!kind || !isId(id) || !isId(vid)) return NextResponse.json({ error: 'Say which version.' }, { status: 400 });
  const a = await authorizePageBlocks(kind, id);
  if ('error' in a) return a.error;
  const { data } = await a.svc.from('page_block_versions').select('blocks').eq('id', vid).eq('entity_type', kind).eq('entity_id', id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'No such version.' }, { status: 404 });
  return NextResponse.json({ blocks: cleanBlocks(data.blocks) });
}
