import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { createNotifications } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';

async function me() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return null;
  return user;
}

// Where the signed-in person stands with this division: 'member' (already in it), 'pending' (asked, waiting), 'declined' (the last ask was declined) or 'none'.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', user.id).eq('division_id', id).limit(1);
  if ((roles ?? []).length) return NextResponse.json({ status: 'member' });
  const { data: div } = await svc.from('divisions').select('join_open').eq('id', id).maybeSingle();
  const { data: last } = await svc
    .from('division_join_requests')
    .select('status')
    .eq('division_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    status: (last?.status as string | undefined) === 'pending' ? 'pending' : last?.status === 'declined' ? 'declined' : 'none',
    closed: div?.join_open === false,
  });
}

// Ask to join: { message? }. One waiting request per person per division. The division's Heads are told.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Sign in to ask to join.' }, { status: 401 });
  const b = (await request.json().catch(() => ({}))) as { message?: string };
  const svc = createServiceClient();
  const { data: division } = await svc.from('divisions').select('id, name, slug, join_open').eq('id', id).maybeSingle();
  if (!division) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  if (division.join_open === false) return NextResponse.json({ error: `${division.name} is not taking join requests right now.` }, { status: 403 });
  const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', user.id).eq('division_id', id).limit(1);
  if ((roles ?? []).length) return NextResponse.json({ error: 'You are already in this division.' }, { status: 409 });
  const { error } = await svc.from('division_join_requests').insert({ division_id: id, user_id: user.id, message: (b.message ?? '').trim().slice(0, 300) || null });
  if (error)
    return NextResponse.json(
      { error: error.code === '23505' ? 'You already asked. The Heads will answer soon.' : 'Could not send that. Try again.' },
      { status: error.code === '23505' ? 409 : 500 },
    );
  const { data: heads } = await svc.from('user_roles').select('user_id').eq('division_id', id).eq('role', 'division');
  const { data: prof } = await svc.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  const name = (prof?.display_name as string | null) || 'Someone';
  await createNotifications(
    svc,
    (heads ?? []).map((h) => ({
      user_id: h.user_id as string,
      type: 'division_join',
      title: `${name} asked to join ${division.name}`,
      body: (b.message ?? '').trim().slice(0, 120) || null,
      href: `/portal/${division.slug}/members`,
    })),
  );
  return NextResponse.json({ ok: true, status: 'pending' }, { status: 201 });
}

// Take the request back.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await me();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await createServiceClient().from('division_join_requests').delete().eq('division_id', id).eq('user_id', user.id).eq('status', 'pending');
  return NextResponse.json({ ok: true });
}
