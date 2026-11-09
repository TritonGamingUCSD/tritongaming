import { NextResponse } from 'next/server';
import { authorizeContentEdit } from '@/lib/site/contentAccess';

export const dynamic = 'force-dynamic';

const nameMap = async (
  svc: { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => PromiseLike<{ data: { id: string; display_name: string | null }[] | null }> } } },
  ids: (string | null)[],
) => {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, string>();
  const { data } = await svc.from('profiles').select('id, display_name').in('id', list);
  return new Map((data ?? []).map((p) => [p.id, p.display_name || 'Someone']));
};

// One Site Content block's saved draft (if any) and the history of what was published (newest first). ?key=<block key>
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  const a = await authorizeContentEdit(key ?? '');
  if ('error' in a) return a.error;
  const [{ data: draft }, { data: versions }] = await Promise.all([
    a.svc.from('site_content_drafts').select('content, saved_by, saved_at').eq('key', key).maybeSingle(),
    a.svc.from('site_content_versions').select('id, saved_by, created_at').eq('key', key).order('created_at', { ascending: false }).limit(30),
  ]);
  const who = await nameMap(a.svc as never, [(draft?.saved_by as string | null) ?? null, ...(versions ?? []).map((v) => v.saved_by as string | null)]);
  return NextResponse.json({
    draft: draft ? { content: draft.content, at: draft.saved_at, by: who.get(draft.saved_by as string) ?? 'Someone' } : null,
    versions: (versions ?? []).map((v) => ({ id: v.id, at: v.created_at, by: who.get(v.saved_by as string) ?? 'Someone' })),
  });
}

// Save the block as a draft: kept on the server, not shown to visitors, until it is published (the editor's Save).
export async function PUT(request: Request) {
  const b = (await request.json().catch(() => ({}))) as { key?: string; content?: unknown };
  const a = await authorizeContentEdit(b.key ?? '');
  if ('error' in a) return a.error;
  if (!b.content || typeof b.content !== 'object' || Array.isArray(b.content)) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  const { error } = await a.svc
    .from('site_content_drafts')
    .upsert({ key: b.key, content: b.content, saved_by: a.user.id, saved_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: 'Could not save the draft.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  const a = await authorizeContentEdit(key ?? '');
  if ('error' in a) return a.error;
  await a.svc.from('site_content_drafts').delete().eq('key', key);
  return NextResponse.json({ ok: true });
}
