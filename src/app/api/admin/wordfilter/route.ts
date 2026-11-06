import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { AREAS, blockedTerms, cleanAllow, cleanTerm, splitWords, type Area, type Term } from '@/lib/wordfilter/filter';
import { loadConfig, refreshTerms } from '@/lib/wordfilter/server';

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
type Auth = Exclude<Awaited<ReturnType<typeof authorize>>, { error: NextResponse }>;

const nameMap = async (svc: Auth['svc'], ids: (string | null)[]) => {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const out = new Map<string, string>();
  if (!uniq.length) return out;
  const { data } = await svc.from('profiles').select('id, display_name').in('id', uniq);
  for (const p of data ?? []) out.set(p.id as string, (p.display_name as string) || 'Someone');
  return out;
};

// Admin → Settings → Word Filter. The built-in list is never sent (only how many words it has); an admin adds words to block, words or phrases to allow (a name, or a word caught by mistake), sees what was refused, and tests a phrase.
//   GET                          { custom, allowed, personal, builtinCount, modes, message, log, history }
//   POST { terms: [..] | term, kind: 'block' | 'allow', partial?, dryRun? }   add several (or preview them): { items: [{ term, status }], added }
//   POST { personal: { userId, term } }       allow one word for one person only
//   DELETE { term, kind } | { personal: { userId, term } }    remove one that was added (the built-in list stays)
//   PUT { text }                 { blocked, matched, warned, sources }: would this be refused, by which listed word, and whose list it is on (admin only)
//   PATCH { mode: { area, value } } | { message } | { undo: true } | { clearLog: true }
export async function GET() {
  const a = await authorize();
  if ('error' in a) return a.error;
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  await a.svc.from('word_filter_log').delete().lt('created_at', since);
  const [{ data }, { data: logRows }, { data: pers }, { data: hist }, cfg] = await Promise.all([
    a.svc.from('word_filter_terms').select('term, kind, partial, builtin, added_by, created_at').order('term'),
    a.svc.from('word_filter_log').select('id, created_at, area, field, term, user_id, mode, source').order('created_at', { ascending: false }).limit(60),
    a.svc.from('word_filter_person_allow').select('user_id, term, created_at').order('created_at', { ascending: false }),
    a.svc.from('word_filter_history').select('id, at, actor_id, batch, action, term, kind, undone').order('at', { ascending: false }).limit(40),
    loadConfig(),
  ]);
  const rows = data ?? [];
  const names = await nameMap(a.svc, [
    ...rows.map((r) => r.added_by as string | null),
    ...(logRows ?? []).map((r) => r.user_id as string | null),
    ...(pers ?? []).map((r) => r.user_id as string),
    ...(hist ?? []).map((r) => r.actor_id as string | null),
  ]);
  const who = (id: string | null) => (id ? (names.get(id) ?? 'Someone') : null);
  const personalSet = new Set((pers ?? []).map((p) => `${p.user_id}|${p.term}`));
  // The latest change that has not been undone, as one batch (a bulk add undoes together).
  const live = (hist ?? []).filter((h) => !h.undone);
  const lastBatch = live[0]?.batch as string | undefined;
  return NextResponse.json({
    custom: rows.filter((r) => !r.builtin && r.kind === 'block').map((r) => ({ term: r.term, partial: !!r.partial, by: who(r.added_by as string | null), at: r.created_at })),
    warned: rows.filter((r) => !r.builtin && r.kind === 'warn').map((r) => ({ term: r.term, by: who(r.added_by as string | null), at: r.created_at })),
    allowed: rows.filter((r) => r.kind === 'allow').map((r) => ({ term: r.term, by: who(r.added_by as string | null), at: r.created_at })),
    personal: (pers ?? []).map((p) => ({ userId: p.user_id, name: who(p.user_id as string), term: p.term, at: p.created_at })),
    builtinCount: rows.filter((r) => r.builtin && r.kind === 'block').length,
    builtinWarnCount: rows.filter((r) => r.builtin && r.kind === 'warn').length,
    modes: cfg.modes,
    message: cfg.message,
    log: (logRows ?? []).map((l) => ({
      id: l.id,
      at: l.created_at,
      area: l.area,
      field: l.field,
      term: l.term,
      userId: l.user_id,
      name: who(l.user_id as string | null),
      mode: l.mode,
      allowedForThem: personalSet.has(`${l.user_id}|${l.term}`),
    })),
    history: (hist ?? []).slice(0, 15).map((h) => ({
      id: h.id,
      at: h.at,
      by: who(h.actor_id as string | null),
      action: h.action,
      term: h.term,
      kind: h.kind,
      undone: h.undone,
      latest: !h.undone && h.batch === lastBatch,
    })),
  });
}

export async function POST(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as {
    term?: string;
    terms?: string[];
    text?: string;
    kind?: string;
    partial?: boolean;
    dryRun?: boolean;
    personal?: { userId?: string; term?: string };
  };

  if (b.personal) {
    const term = cleanTerm(b.personal.term ?? '');
    if (term.length < 2 || !b.personal.userId) return NextResponse.json({ error: 'Say which word and which person.' }, { status: 400 });
    await a.svc.from('word_filter_person_allow').upsert({ user_id: b.personal.userId, term, added_by: a.user.id }, { onConflict: 'user_id,term' });
    refreshTerms();
    await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'word filter', entityId: term, summary: 'Word filter: allowed a word for one person' });
    return NextResponse.json({ ok: true });
  }

  if (b.kind !== 'block' && b.kind !== 'allow' && b.kind !== 'warn') return NextResponse.json({ error: 'Block it, warn about it or allow it?' }, { status: 400 });
  const kind = b.kind;
  const clean = kind === 'allow' ? cleanAllow : cleanTerm;
  const raw = b.text ?? (b.terms ? b.terms.join(',') : (b.term ?? ''));
  const { words, invalid } = splitWords(raw, clean);
  if (!words.length && !invalid.length) return NextResponse.json({ error: 'Type a word (letters only, at least 2).' }, { status: 400 });
  if (words.length > 200) return NextResponse.json({ error: 'That is a lot at once. Add up to 200 words at a time.' }, { status: 400 });

  const { data: existing } = await a.svc.from('word_filter_terms').select('term, kind, partial, builtin');
  const all: Term[] = (existing ?? []).map((r) => ({ term: r.term as string, kind: r.kind as 'block' | 'warn' | 'allow', partial: !!r.partial, builtin: !!r.builtin }));
  const items: { term: string; status: 'new' | 'duplicate' | 'built-in' | 'covered' | 'invalid' }[] = invalid.map((term) => ({ term, status: 'invalid' as const }));
  for (const w of words) {
    const same = all.find((t) => t.term === w && t.kind === kind);
    if (same) items.push({ term: w, status: same.builtin ? 'built-in' : 'duplicate' });
    else if (kind !== 'allow' && blockedTerms(w, all).length)
      items.push({ term: w, status: 'covered' }); // a spelling the block list already catches
    else if (kind === 'block' && blockedTerms(w, all, 'warn').length) items.push({ term: w, status: 'new' });
    else items.push({ term: w, status: 'new' });
  }
  const fresh = items.filter((i) => i.status === 'new').map((i) => i.term);
  if (b.dryRun || !fresh.length) return NextResponse.json({ items, added: 0 });

  const { error } = await a.svc.from('word_filter_terms').upsert(
    fresh.map((term) => ({ term, kind, partial: kind !== 'allow' && !!b.partial, builtin: false, added_by: a.user.id })),
    { onConflict: 'term,kind' },
  );
  if (error) return NextResponse.json({ error: 'Could not save that.' }, { status: 500 });
  const batch = crypto.randomUUID();
  await a.svc.from('word_filter_history').insert(fresh.map((term) => ({ actor_id: a.user.id, batch, action: 'add', term, kind, partial: kind !== 'allow' && !!b.partial })));
  refreshTerms();
  await logAudit(a.svc, {
    actorId: a.user.id,
    action: 'update',
    entityType: 'word filter',
    entityId: fresh[0],
    summary: `Word filter: ${kind === 'block' ? 'blocked' : kind === 'warn' ? 'put on the warning list' : 'allowed'} ${fresh.length === 1 ? 'a word' : `${fresh.length} words`}`,
  });
  return NextResponse.json({ items, added: fresh.length });
}

export async function DELETE(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { term?: string; kind?: string; personal?: { userId?: string; term?: string } };
  if (b.personal) {
    await a.svc
      .from('word_filter_person_allow')
      .delete()
      .eq('user_id', b.personal.userId ?? '')
      .eq('term', cleanTerm(b.personal.term ?? ''));
    refreshTerms();
    return NextResponse.json({ ok: true });
  }
  const term = (b.kind === 'allow' ? cleanAllow : cleanTerm)(b.term ?? '');
  const { data: gone } = await a.svc
    .from('word_filter_terms')
    .delete()
    .eq('term', term)
    .eq('kind', b.kind ?? '')
    .eq('builtin', false)
    .select('term, kind, partial');
  if (gone?.length) await a.svc.from('word_filter_history').insert({ actor_id: a.user.id, action: 'remove', term, kind: gone[0].kind, partial: !!gone[0].partial });
  refreshTerms();
  await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'word filter', entityId: term, summary: `Word filter: removed a ${b.kind} word` });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { text?: string };
  const { terms } = await loadConfig();
  const text = String(b.text ?? '').slice(0, 2000);
  const matched = blockedTerms(text, terms);
  const warned = blockedTerms(text, terms, 'warn');
  const sources: Record<string, string> = {};
  for (const m of matched) sources[m] = terms.find((t) => t.term === m && t.kind === 'block')?.builtin ? 'built-in' : 'yours';
  return NextResponse.json({ blocked: matched.length > 0, matched, warned, sources });
}

export async function PATCH(request: Request) {
  const a = await authorize();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { mode?: { area?: string; value?: string }; message?: unknown; undo?: boolean; clearLog?: boolean };

  if (b.mode) {
    const area = b.mode.area as Area;
    if (!(AREAS as readonly string[]).includes(area) || !['on', 'log', 'off'].includes(b.mode.value ?? ''))
      return NextResponse.json({ error: 'Pick an area and a mode.' }, { status: 400 });
    await a.svc.from('team_settings').upsert({ key: `wf_mode_${area}`, value: b.mode.value }, { onConflict: 'key' });
    refreshTerms();
    await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'word filter', entityId: area, summary: `Word filter: ${area} set to ${b.mode.value}` });
    return NextResponse.json({ ok: true });
  }

  if (b.message !== undefined) {
    const msg = String(b.message).trim().slice(0, 200);
    if (msg) await a.svc.from('team_settings').upsert({ key: 'wf_message', value: msg }, { onConflict: 'key' });
    else await a.svc.from('team_settings').delete().eq('key', 'wf_message');
    refreshTerms();
    await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'word filter', entityId: 'message', summary: 'Word filter: changed the message people see' });
    return NextResponse.json({ ok: true });
  }

  if (b.clearLog) {
    await a.svc.from('word_filter_log').delete().gte('created_at', '2000-01-01');
    return NextResponse.json({ ok: true });
  }

  if (b.undo) {
    const { data: last } = await a.svc.from('word_filter_history').select('batch').eq('undone', false).order('at', { ascending: false }).limit(1).maybeSingle();
    if (!last) return NextResponse.json({ error: 'Nothing to undo.' }, { status: 404 });
    const { data: rows } = await a.svc.from('word_filter_history').select('id, action, term, kind, partial').eq('batch', last.batch).eq('undone', false);
    for (const r of rows ?? []) {
      if (r.action === 'add') await a.svc.from('word_filter_terms').delete().eq('term', r.term).eq('kind', r.kind).eq('builtin', false);
      else await a.svc.from('word_filter_terms').upsert({ term: r.term, kind: r.kind, partial: !!r.partial, builtin: false, added_by: a.user.id }, { onConflict: 'term,kind' });
    }
    await a.svc.from('word_filter_history').update({ undone: true }).eq('batch', last.batch);
    refreshTerms();
    await logAudit(a.svc, {
      actorId: a.user.id,
      action: 'update',
      entityType: 'word filter',
      entityId: 'undo',
      summary: `Word filter: undid ${(rows ?? []).length === 1 ? 'a change' : `${rows?.length} changes`}`,
    });
    return NextResponse.json({ ok: true, undone: (rows ?? []).length });
  }
  return NextResponse.json({ error: 'Nothing to do.' }, { status: 400 });
}
