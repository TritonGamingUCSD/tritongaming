import { invalidate } from '@/lib/revalidate';
import { logAudit, currentActorId } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

export async function GET() {
  // Public read — anyone can fetch content for rendering
  const supabase = await createClient();
  const { data } = await supabase.from('site_contents').select('key, content, updated_at');
  return NextResponse.json({ content: data ?? [] });
}

export async function POST(request: Request) {
  // 1. Verify caller is officer+
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await userClient
    .from('user_roles').select('role, division_id').eq('user_id', user.id);

  if (!hasCapability(roles ?? [], 'manage_site_content')) {
    return NextResponse.json({ error: 'Content editor access required (lead, exec, or admin)' }, { status: 403 });
  }

  const body = await request.json() as { key?: string; content?: Record<string, unknown> };
  const { key, content } = body;

  if (!key || content === undefined) {
    return NextResponse.json({ error: 'Missing key or content' }, { status: 400 });
  }

  // 2. Upsert via service client — bypasses RLS; auth is already verified above
  const adminClient = createServiceClient();
  const { error } = await adminClient
    .from('site_contents')
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

  await logAudit(adminClient, { actorId: user.id, action: 'update', entityType: 'site content', entityId: key, summary: `Site content "${key}" edited` });
  invalidate('site-content');
  return NextResponse.json({ ok: true });
}
