import { NextResponse } from 'next/server';
import { authorizeContentEdit } from '@/lib/site/contentAccess';

export const dynamic = 'force-dynamic';

// The content of one earlier published version, to load into the editor (it goes live only when saved). ?key=<block key>
export async function GET(request: Request, { params }: { params: Promise<{ vid: string }> }) {
  const { vid } = await params;
  const key = new URL(request.url).searchParams.get('key');
  const a = await authorizeContentEdit(key ?? '');
  if ('error' in a) return a.error;
  if (!/^[0-9a-f-]{36}$/i.test(vid)) return NextResponse.json({ error: 'Say which version.' }, { status: 400 });
  const { data } = await a.svc.from('site_content_versions').select('content').eq('id', vid).eq('key', key).maybeSingle();
  if (!data) return NextResponse.json({ error: 'No such version.' }, { status: 404 });
  return NextResponse.json({ content: data.content });
}
