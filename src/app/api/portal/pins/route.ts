import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { SECTIONS } from '@/lib/portal/sections';

export const dynamic = 'force-dynamic';

// Star or un-star a page. Whether the person can open the page is decided where it is shown (All Functions only lists pages they can open), so this only checks that the page exists.
export async function PUT(req: Request) {
  const {
    data: { user },
  } = await strictUser(await createClient());
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { section_id?: string; pinned?: boolean } | null;
  const id = body?.section_id;
  if (!id || typeof body?.pinned !== 'boolean' || !SECTIONS.some((s) => s.id === id)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const svc = createServiceClient();
  const { error } = body.pinned
    ? await svc.from('portal_pins').upsert({ user_id: user.id, section_id: id }, { onConflict: 'user_id,section_id', ignoreDuplicates: true })
    : await svc.from('portal_pins').delete().eq('user_id', user.id).eq('section_id', id);
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
