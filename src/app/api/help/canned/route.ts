import { NextResponse } from 'next/server';
import { authorizeHelp } from '@/lib/help';

export const dynamic = 'force-dynamic';

// Saved replies for handling help tickets (exec and admin only).
async function staff() {
  const auth = await authorizeHelp();
  if (auth.error) return { error: auth.error } as const;
  if (!auth.isStaff) return { error: NextResponse.json({ error: 'Only exec and admins can use saved replies.' }, { status: 403 }) } as const;
  return auth;
}

export async function GET() {
  const auth = await staff();
  if ('error' in auth && auth.error) return auth.error;
  const { data } = await auth.svc.from('help_canned_replies').select('id, title, body').order('title');
  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await staff();
  if ('error' in auth && auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const title = String(b.title ?? '').trim().slice(0, 60), body = String(b.body ?? '').trim().slice(0, 2000);
  if (!title || !body) return NextResponse.json({ error: 'Add a title and the reply text.' }, { status: 400 });
  const { data, error } = b.id
    ? await auth.svc.from('help_canned_replies').update({ title, body }).eq('id', b.id).select('id').single()
    : await auth.svc.from('help_canned_replies').insert({ title, body, created_by: auth.user.id }).select('id').single();
  if (error) return NextResponse.json({ error: 'Failed to save.' }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: b.id ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const auth = await staff();
  if ('error' in auth && auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  await auth.svc.from('help_canned_replies').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
