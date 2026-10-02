import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';

// The Site Content editor keeps its unsaved edits here so /preview can render the real page with them.
export async function PUT(request: Request) {
  const userClient = await createClient();
  // The session token is checked locally (no round trip to the auth server); the role lookup below is the real gate.
  const { data: claims } = await userClient.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await userClient.from('user_roles').select('role, division_id').eq('user_id', userId);
  if (!hasCapability(roles ?? [], 'manage_site_content')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null) as { drafts?: Record<string, Record<string, unknown>> } | null;
  const drafts = body?.drafts;
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts) || JSON.stringify(drafts).length > 1_000_000) {
    return NextResponse.json({ error: 'Bad drafts' }, { status: 400 });
  }
  const { error } = await createServiceClient().from('content_drafts').upsert({ user_id: userId, drafts, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
