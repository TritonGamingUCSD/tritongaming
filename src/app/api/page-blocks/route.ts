import { NextResponse } from 'next/server';
import { cleanBlocks } from '@/lib/site/pageBlocks';
import { authorizePageBlocks, isId, pageKind } from '@/lib/site/pageBlocksAccess';

export const dynamic = 'force-dynamic';

const names = async (svc: Awaited<ReturnType<typeof authorizePageBlocks>> extends infer R ? (R extends { svc: infer S } ? S : never) : never, ids: (string | null)[]) => {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, string>();
  const { data } = await svc.from('profiles').select('id, display_name').in('id', list);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string) || 'Someone']));
};

// The saved draft of a page's blocks (if any) and the history of what was published (newest first, without the blocks themselves). ?type=event|division&id=<id>
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = pageKind(q.get('type'));
  const id = q.get('id');
  if (!kind || !isId(id)) return NextResponse.json({ error: 'Say which page.' }, { status: 400 });
  const a = await authorizePageBlocks(kind, id);
  if ('error' in a) return a.error;
  const [{ data: draft }, { data: versions }] = await Promise.all([
    a.svc.from('page_block_drafts').select('blocks, saved_by, saved_at').eq('entity_type', kind).eq('entity_id', id).maybeSingle(),
    a.svc.from('page_block_versions').select('id, blocks, saved_by, created_at').eq('entity_type', kind).eq('entity_id', id).order('created_at', { ascending: false }).limit(40),
  ]);
  const who = await names(a.svc, [(draft?.saved_by as string | null) ?? null, ...(versions ?? []).map((v) => v.saved_by as string | null)]);
  return NextResponse.json({
    draft: draft ? { blocks: cleanBlocks(draft.blocks), at: draft.saved_at, by: who.get(draft.saved_by as string) ?? 'Someone' } : null,
    versions: (versions ?? []).map((v) => ({ id: v.id, at: v.created_at, by: who.get(v.saved_by as string) ?? 'Someone', count: Array.isArray(v.blocks) ? v.blocks.length : 0 })),
  });
}

// Save the blocks as a draft: kept on the server, not shown to visitors, until the page is saved (published).
export async function PUT(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { type?: unknown; id?: unknown; blocks?: unknown };
  const kind = pageKind(b.type);
  if (!kind || !isId(b.id)) return NextResponse.json({ error: 'Say which page.' }, { status: 400 });
  const a = await authorizePageBlocks(kind, b.id);
  if ('error' in a) return a.error;
  const blocks = cleanBlocks(b.blocks);
  const { error } = await a.svc
    .from('page_block_drafts')
    .upsert({ entity_type: kind, entity_id: b.id, blocks, saved_by: a.user.id, saved_at: new Date().toISOString() }, { onConflict: 'entity_type,entity_id' });
  if (error) return NextResponse.json({ error: 'Could not save the draft.' }, { status: 500 });
  return NextResponse.json({ ok: true, count: blocks.length });
}

// Throw the draft away.
export async function DELETE(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = pageKind(q.get('type'));
  const id = q.get('id');
  if (!kind || !isId(id)) return NextResponse.json({ error: 'Say which page.' }, { status: 400 });
  const a = await authorizePageBlocks(kind, id);
  if ('error' in a) return a.error;
  await a.svc.from('page_block_drafts').delete().eq('entity_type', kind).eq('entity_id', id);
  return NextResponse.json({ ok: true });
}
