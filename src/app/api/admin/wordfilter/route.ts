import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { blockedTerms, cleanTerm } from '@/lib/wordfilter/filter';
import { loadTerms, refreshTerms } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_roles')) return { error: NextResponse.json({ error: 'Only admins can change the word filter.' }, { status: 403 }) };
  return { user, svc: createServiceClient() };
}

// Admin → Settings → Word Filter. The built-in list is never sent (only how many words it has); the admin adds words to block, words to allow (a name or a word that is wrongly caught), and can test a phrase.
//   GET                          { custom: [...], allowed: [...], builtinCount }
//   POST { term, kind: 'block' | 'allow', partial? }   add one
//   DELETE { term, kind }        remove one that was added (the built-in list stays)
//   PUT { text }                 { blocked, matched }: would this be refused, and by which listed word (shown to the admin only)
export async function GET() {
  const a = await authorize();
  if ('error' in a) return a.error;
  const { data } = await a.svc.from('word_filter_terms').select('term, kind, partial, builtin').order('term');
  const rows = data ?? [];
  return NextResponse.json({
    custom: rows.filter((r) => !r.builtin && r.kind === 'block').map((r) => ({ term: r.term, partial: !!r.partial })),
    allowed: rows.filter((r) => r.kind === 'allow').map((r) => ({ term: r.term })),
    builtinCount: rows.filter((r) => r.builtin && r.kind === 'block').length,
  });
}

export async function POST(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { term?: string; kind?: string; partial?: boolean };
  const term = cleanTerm(b.term ?? '');
  if (term.length < 2) return NextResponse.json({ error: 'Type a word (letters only, at least 2).' }, { status: 400 });
  if (b.kind !== 'block' && b.kind !== 'allow') return NextResponse.json({ error: 'Block it or allow it?' }, { status: 400 });
  const { error } = await a.svc
    .from('word_filter_terms')
    .upsert({ term, kind: b.kind, partial: b.kind === 'block' && !!b.partial, builtin: false, added_by: a.user.id }, { onConflict: 'term,kind' });
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  refreshTerms();
  await logAudit(a.svc, {
    actorId: a.user.id,
    action: 'update',
    entityType: 'word filter',
    entityId: term,
    summary: `Word filter: ${b.kind === 'block' ? 'blocked' : 'allowed'} a word`,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { term?: string; kind?: string };
  const term = cleanTerm(b.term ?? '');
  await a.svc
    .from('word_filter_terms')
    .delete()
    .eq('term', term)
    .eq('kind', b.kind ?? '')
    .eq('builtin', false);
  refreshTerms();
  await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'word filter', entityId: term, summary: `Word filter: removed a ${b.kind} word` });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { text?: string };
  const terms = await loadTerms();
  const matched = blockedTerms(String(b.text ?? '').slice(0, 2000), terms);
  return NextResponse.json({ blocked: matched.length > 0, matched });
}
