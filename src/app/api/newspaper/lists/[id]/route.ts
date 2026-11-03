import { NextResponse } from 'next/server';
import { cleanRules, rulesEmpty } from '@/lib/newspaper/rules';
import { UUID, authorizeNewspaper } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

// PATCH { name?, rules? } and DELETE one saved audience (issues that used it keep their own copy of the rules).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string') {
    const n = b.name.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!n) return NextResponse.json({ error: 'Give the audience a name.' }, { status: 400 });
    patch.name = n;
  }
  if ('rules' in b) {
    const rules = cleanRules(b.rules);
    if (rulesEmpty(rules)) return NextResponse.json({ error: 'Pick who is in it first.' }, { status: 400 });
    patch.rules = rules;
  }
  const { data } = await auth.svc.from('newspaper_lists').update(patch).eq('id', id).select('id, name, rules, updated_at').maybeSingle();
  if (!data) return NextResponse.json({ error: 'That audience is gone.' }, { status: 404 });
  return NextResponse.json({ list: { ...data, rules: cleanRules(data.rules) } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (UUID.test(id)) await auth.svc.from('newspaper_lists').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
