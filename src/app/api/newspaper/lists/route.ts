import { NextResponse } from 'next/server';
import { cleanRules, rulesEmpty } from '@/lib/newspaper/rules';
import { authorizeNewspaper } from '@/lib/newspaper/server';

export const dynamic = 'force-dynamic';

// Saved audiences: a named set of rules to pick again for another issue. Anyone who writes can use and make them; changing one applies to the issues that use it from then on.
//   GET   every list   ·   POST { name, rules }   save a new one
export async function GET() {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('newspaper_lists').select('id, name, rules, updated_at').order('name').limit(200);
  return NextResponse.json({ lists: (data ?? []).map((l) => ({ ...l, rules: cleanRules(l.rules) })) });
}

export async function POST(request: Request) {
  const auth = await authorizeNewspaper('write');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = typeof b.name === 'string' ? b.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!name) return NextResponse.json({ error: 'Give the audience a name.' }, { status: 400 });
  const rules = cleanRules(b.rules);
  if (rulesEmpty(rules)) return NextResponse.json({ error: 'Pick who is in it first.' }, { status: 400 });
  const { data, error } = await auth.svc.from('newspaper_lists').insert({ name, rules, created_by: auth.user.id }).select('id, name, rules, updated_at').single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save it.' }, { status: 500 });
  return NextResponse.json({ list: { ...data, rules } }, { status: 201 });
}
