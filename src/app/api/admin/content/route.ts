import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasRole } from '@/types/database';
import type { UserRole } from '@/types/database';

export async function GET() {
  // Public read — anyone can fetch content for rendering
  const supabase = await createClient();
  const { data } = await supabase.from('site_content').select('key, content, updated_at');
  return NextResponse.json({ content: data ?? [] });
}

export async function POST(request: Request) {
  // 1. Verify caller is officer+
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await userClient
    .from('profiles').select('role').eq('id', user.id).single();

  if (!profile || !hasRole(profile.role as UserRole, 'officer')) {
    return NextResponse.json({ error: 'Officer access required' }, { status: 403 });
  }

  const body = await request.json() as { key?: string; content?: Record<string, unknown> };
  const { key, content } = body;

  if (!key || content === undefined) {
    return NextResponse.json({ error: 'Missing key or content' }, { status: 400 });
  }

  // 2. Upsert via service client — bypasses RLS; auth is already verified above
  const adminClient = createServiceClient();
  const { error } = await adminClient
    .from('site_content')
    .upsert(
      {
        key,
        title: key,          // default title = key (satisfies NOT NULL)
        content,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('[content] upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
