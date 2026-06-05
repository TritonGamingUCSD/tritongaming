import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/types/database';

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from('site_content').select('key, content, updated_at');
  return NextResponse.json({ content: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();

  if (!profile || !hasRole(profile.role as import('@/types/database').UserRole, 'officer')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { key, content } = await request.json() as { key: string; content: Record<string, unknown> };
  if (!key || typeof content === 'undefined') {
    return NextResponse.json({ error: 'Missing key or content' }, { status: 400 });
  }

  const { error } = await supabase
    .from('site_content')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({
      key,
      content,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
