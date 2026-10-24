import { NextResponse } from 'next/server';
import { authorizeTrivia, findQuiz, UUID } from '@/lib/trivia/server';
import { CAPABILITY_ROLES } from '@/lib/portal/capabilities';

export const dynamic = 'force-dynamic';

// Who a restricted quiz is shared with. Only the quiz's creator and Admins see or change this. The people who can be added are those who can host Trivia at all.
async function manager(id: string) {
  const auth = await authorizeTrivia('host');
  if (auth.error) return { error: auth.error };
  const quiz = await findQuiz(auth.svc, id);
  if (!quiz) return { error: NextResponse.json({ error: 'That quiz is gone.' }, { status: 404 }) };
  if (!auth.isAdmin && quiz.created_by !== auth.user.id) return { error: NextResponse.json({ error: 'Only the quiz’s creator or an Admin can change who it is shared with.' }, { status: 403 }) };
  return { auth, quiz };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await manager((await params).id);
  if ('error' in m) return m.error;
  const { auth, quiz } = m;
  const [access, roles] = await Promise.all([
    auth.svc.from('trivia_quiz_access').select('user_id').eq('quiz_id', quiz.id).limit(500),
    auth.svc.from('user_roles').select('user_id, role').in('role', CAPABILITY_ROLES.host_trivia).limit(5000),
  ]);
  const have = (access.data ?? []).map((a) => a.user_id as string);
  const ids = [...new Set([...(roles.data ?? []).map((r) => r.user_id as string), ...have, ...(quiz.created_by ? [quiz.created_by] : [])])];
  const names = new Map<string, string>();
  if (ids.length) for (const p of (await auth.svc.from('profiles').select('id, display_name').in('id', ids).limit(5000)).data ?? []) names.set(p.id as string, (p.display_name as string | null)?.trim() || 'Member');
  const people = ids.map((id) => ({ id, name: names.get(id) ?? 'Member' })).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ people, members: have, creator: quiz.created_by });
}

// Replace the list.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await manager((await params).id);
  if ('error' in m) return m.error;
  const { auth, quiz } = m;
  const b = await request.json().catch(() => ({}));
  if (!Array.isArray(b.members)) return NextResponse.json({ error: 'Send the list of people.' }, { status: 400 });
  const want = [...new Set((b.members as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 200).filter((id) => id !== quiz.created_by);
  // Only people who can host Trivia can be added.
  const { data: eligible } = want.length ? await auth.svc.from('user_roles').select('user_id').in('user_id', want).in('role', CAPABILITY_ROLES.host_trivia) : { data: [] };
  const ok = new Set((eligible ?? []).map((r) => r.user_id as string));
  const ids = want.filter((id) => ok.has(id));
  const { data: now } = await auth.svc.from('trivia_quiz_access').select('user_id').eq('quiz_id', quiz.id).limit(500);
  const have = new Set((now ?? []).map((r) => r.user_id as string));
  const drop = [...have].filter((id) => !ids.includes(id));
  const add = ids.filter((id) => !have.has(id));
  if (drop.length) await auth.svc.from('trivia_quiz_access').delete().eq('quiz_id', quiz.id).in('user_id', drop);
  if (add.length) {
    const { error } = await auth.svc.from('trivia_quiz_access').insert(add.map((user_id) => ({ quiz_id: quiz.id, user_id, added_by: auth.user.id })));
    if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  }
  return NextResponse.json({ members: ids });
}
