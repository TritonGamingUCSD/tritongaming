import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';

export const dynamic = 'force-dynamic';

async function execUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user || user.is_anonymous) return null;
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  return (roles ?? []).some((r) => r.role === 'exec' || r.role === 'admin') ? user : null;
}

// Post the Home shout-out (exec and admin). A new one replaces the showing one.
export async function POST(req: Request) {
  const user = await execUser();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { message?: string; link_url?: string; days?: number } | null;
  const message = body?.message?.trim() ?? '';
  const days = Math.min(30, Math.max(1, Math.round(Number(body?.days) || 7)));
  let link = body?.link_url?.trim() || null;
  if (link && !/^(https:\/\/|\/portal\/)/.test(link)) return NextResponse.json({ error: 'The link must start with https:// or /portal/' }, { status: 400 });
  if (!message || message.length > 280) return NextResponse.json({ error: 'Write 1 to 280 characters' }, { status: 400 });
  link = link || null;
  const svc = createServiceClient();
  const now = new Date().toISOString();
  await svc.from('home_shoutouts').update({ expires_at: now }).gt('expires_at', now);
  const { error } = await svc.from('home_shoutouts').insert({ message, link_url: link, expires_at: new Date(Date.now() + days * 86400000).toISOString(), created_by: user.id });
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Take the showing shout-out down.
export async function DELETE() {
  const user = await execUser();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const now = new Date().toISOString();
  await createServiceClient().from('home_shoutouts').update({ expires_at: now }).gt('expires_at', now);
  return NextResponse.json({ ok: true });
}
