import { NextResponse } from 'next/server';
import { cleanTags } from '@/lib/docs/docsTree';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';

export const dynamic = 'force-dynamic';

// Change a doc's icon, cover, pin, tags or attachments without touching its text: { id, icon?, cover_url?, pinned?, add_tags?, remove_tags?, add_attachments?, remove_attachment_urls? }.
// Only the fields you send change, and tags and attachments are added or removed one by one, so two people changing them at once don't wipe each other's work.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const { data: doc } = await auth.svc.from('docs').select('id, tags, attachments').eq('id', id).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'This doc was deleted by someone else.', code: 'deleted' }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if ('icon' in b) patch.icon = b.icon ? String(b.icon).slice(0, 8) : null;
  if ('cover_url' in b) {
    const url = b.cover_url ? String(b.cover_url).trim() : '';
    if (url && !/^https?:\/\//i.test(url)) return bad('The cover must be an image link starting with https://.');
    patch.cover_url = url || null;
  }
  if ('pinned' in b) patch.pinned = b.pinned === true;
  if ('add_tags' in b || 'remove_tags' in b) {
    const remove = new Set(cleanTags(b.remove_tags));
    patch.tags = cleanTags([...((doc.tags as string[]) ?? []).filter((t) => !remove.has(t)), ...cleanTags(b.add_tags)]);
  }
  if ('add_attachments' in b || 'remove_attachment_urls' in b) {
    const gone = new Set(Array.isArray(b.remove_attachment_urls) ? b.remove_attachment_urls.map(String) : []);
    const add = (Array.isArray(b.add_attachments) ? b.add_attachments : []).filter((a: unknown): a is { name: string; url: string; kind: string } => !!a && typeof (a as { url?: unknown }).url === 'string' && /^https?:\/\//i.test((a as { url: string }).url))
      .map((a: { name: string; url: string; kind: string }) => ({ name: String(a.name ?? 'File').slice(0, 120), url: a.url, kind: a.kind === 'google_album' ? 'google_album' : 'file' }));
    const have = ((doc.attachments as { name: string; url: string; kind: string }[]) ?? []).filter((a) => !gone.has(a.url));
    patch.attachments = [...have, ...add.filter((a: { url: string }) => !have.some((h) => h.url === a.url))].slice(0, 40);
  }
  if (Object.keys(patch).length === 0) return bad('Nothing to change.');
  const { data, error } = await auth.svc.from('docs').update(patch).eq('id', id).select('id, icon, cover_url, pinned, tags, attachments').single();
  if (error) return bad('Couldn’t save that.', 500);
  await notifyDocs();
  return NextResponse.json({ doc: data });
}
