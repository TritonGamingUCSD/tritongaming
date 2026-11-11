import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { PAGE_CODE, codeIsLive } from '@/lib/pageCodes';

export const dynamic = 'force-dynamic';

// The portal's code box asks here when six digits are not a meeting, ticket, Trivia game, poll or reward: is it a page code? Anyone signed in may ask; the answer is only where it goes and its name (the page itself still decides who may see it).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!PAGE_CODE.test(code)) return NextResponse.json({ error: 'Not a page code.' }, { status: 404 });
  const svc = createServiceClient();
  const { data } = await svc.from('page_codes').select('id, label, destination, is_active, expires_at, uses').eq('code', code).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not a page code.' }, { status: 404 });
  if (!codeIsLive(data)) return NextResponse.json({ error: 'That page code has ended.' }, { status: 409 });
  await svc
    .from('page_codes')
    .update({ uses: (data.uses ?? 0) + 1 })
    .eq('id', data.id);
  return NextResponse.json({ href: data.destination, label: data.label });
}
