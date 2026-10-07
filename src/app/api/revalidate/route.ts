import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { invalidate, type CacheTag } from '@/lib/site/revalidate';

const ALLOWED: CacheTag[] = ['events', 'board', 'divisions', 'site-content'];

// Lets the browser refresh the public caches after saves it does itself
// through Supabase directly (event editor, profile). Only signed-in users;
// it can't change data, only make public pages re-read it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tags = (Array.isArray(body.tags) ? body.tags : []).filter((t: unknown): t is CacheTag => ALLOWED.includes(t as CacheTag));
  invalidate(...tags);
  return NextResponse.json({ ok: true, tags });
}
