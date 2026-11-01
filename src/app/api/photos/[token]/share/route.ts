import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { TOKEN } from '@/lib/photobooth/token';

export const dynamic = 'force-dynamic';

// A guest's choice to show their picture in the booth's gallery (or take it out again): POST { shared: boolean }. No sign-in; the long random address of the picture is the key, and only its owner has it.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN.test(token)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (typeof b.shared !== 'boolean') return NextResponse.json({ error: 'Say whether to share it.' }, { status: 400 });
  const svc = createServiceClient();
  const { data } = await svc.from('photobooth_photos').select('id, expires_at').eq('token', token).maybeSingle();
  if (!data || new Date(data.expires_at as string).getTime() <= Date.now()) return NextResponse.json({ error: 'This photo is gone.' }, { status: 404 });
  const { error } = await svc.from('photobooth_photos').update({ shared: b.shared }).eq('id', data.id);
  if (error) return NextResponse.json({ error: 'Couldn’t save that. Try again.' }, { status: 500 });
  return NextResponse.json({ shared: b.shared });
}
