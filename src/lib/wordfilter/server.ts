import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { invalidate } from '@/lib/site/revalidate';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { AREAS, areaOf, blockedMessage, blockedTerms, type Area, type LogMode, type Mode, type Term } from './filter';

export interface FilterConfig {
  terms: Term[];
  modes: Record<Area, Mode>;
  message: string;
}
const DEFAULT_MODES: Record<Area, Mode> = { profiles: 'on', content: 'on', messages: 'on' };

// The lists and settings, read once and kept a minute (tag 'wordfilter', refreshed when an admin edits them). If the read fails nothing is blocked: a database hiccup must never stop people from saving.
export async function loadConfig(): Promise<FilterConfig> {
  try {
    return await unstable_cache(
      async () => {
        const svc = createServiceClient();
        const [t, s] = await Promise.all([
          svc.from('word_filter_terms').select('term, kind, partial, builtin'),
          svc.from('team_settings').select('key, value').or('key.like.wf_mode_%,key.eq.wf_message'),
        ]);
        if (t.error) throw t.error;
        const modes = { ...DEFAULT_MODES };
        let message = '';
        for (const r of s.data ?? []) {
          if (r.key === 'wf_message') message = String(r.value);
          else {
            const area = String(r.key).replace('wf_mode_', '') as Area;
            if ((AREAS as readonly string[]).includes(area) && (r.value === 'log' || r.value === 'off' || r.value === 'on')) modes[area] = r.value;
          }
        }
        const terms = (t.data ?? []).map((r) => ({ term: r.term as string, kind: r.kind as 'block' | 'warn' | 'allow', partial: !!r.partial, builtin: !!r.builtin }));
        return { terms, modes, message } satisfies FilterConfig;
      },
      ['word-filter-config'],
      { revalidate: 60, tags: ['wordfilter'] },
    )();
  } catch {
    return { terms: [], modes: DEFAULT_MODES, message: '' };
  }
}
export const loadTerms = async () => (await loadConfig()).terms;
export const refreshTerms = () => invalidate('wordfilter');

async function currentUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await strictUser(await createClient());
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** Record one refusal (or log-only pass). It keeps the word that matched and where, never the text. Failing to log never stops a save. */
export async function logBlocked(e: { area: Area; field: string | null; term: string; userId: string | null; mode: LogMode; source: 'server' | 'report' }) {
  try {
    await createServiceClient().from('word_filter_log').insert({ area: e.area, field: e.field, term: e.term, user_id: e.userId, mode: e.mode, source: e.source });
  } catch {
    /* the log is a convenience */
  }
}

/** What a hit looks like after the signed-in person's own allowed words are taken into account (empty = fine for them). */
async function hitsFor(value: string | null | undefined, cfg: FilterConfig, userId: string | null, kind: 'block' | 'warn' = 'block'): Promise<string[]> {
  let hits = blockedTerms(value, cfg.terms, kind);
  if (hits.length && userId) {
    const { data } = await createServiceClient().from('word_filter_person_allow').select('term').eq('user_id', userId);
    if (data?.length) hits = blockedTerms(value, [...cfg.terms, ...data.map((r) => ({ term: r.term as string, kind: 'allow' as const }))], kind);
  }
  return hits;
}

// The first line of a route that saves words anyone can read: `const bad = await refuseBlocked({ Title: title, Description: body }); if (bad) return bad;`.
// Answers 422 naming the field (never the word) when something is blocked, and null when everything is fine, the filter is off or the area is log only. Every hit is logged.
export async function refuseBlocked(fields: Record<string, string | null | undefined>): Promise<NextResponse | null> {
  if ((await getOffSwitches()).includes('word_filter')) return null;
  const cfg = await loadConfig();
  if (cfg.terms.length === 0) return null;
  let userId: string | null | undefined;
  for (const [label, value] of Object.entries(fields)) {
    const area = areaOf(label);
    const mode = cfg.modes[area];
    if (mode === 'off') continue;
    if (!blockedTerms(value, cfg.terms).length) {
      // not on the block list: the warning list lets it through but flags it for the admin
      if (blockedTerms(value, cfg.terms, 'warn').length) {
        if (userId === undefined) userId = await currentUserId();
        const w = await hitsFor(value, cfg, userId, 'warn');
        if (w.length) await logBlocked({ area, field: label, term: w[0], userId, mode: 'warn', source: 'server' });
      }
      continue;
    }
    if (userId === undefined) userId = await currentUserId();
    const hits = await hitsFor(value, cfg, userId);
    if (!hits.length) continue;
    await logBlocked({ area, field: label, term: hits[0], userId, mode, source: 'server' });
    if (mode === 'on') return NextResponse.json({ error: blockedMessage(label, cfg.message), field: label }, { status: 422 });
  }
  return null;
}

/** Used by the report route: the pages that save straight to the database learn of a refusal here, because a refused save cannot log itself. */
export async function reportBlocked(area: Area, fields: Record<string, string | null | undefined>): Promise<string> {
  const cfg = await loadConfig();
  if ((await getOffSwitches()).includes('word_filter') || cfg.modes[area] === 'off') return '';
  const userId = await currentUserId();
  for (const [label, value] of Object.entries(fields)) {
    const hits = await hitsFor(value, cfg, userId);
    if (hits.length) await logBlocked({ area, field: label, term: hits[0], userId, mode: 'on', source: 'report' });
  }
  return cfg.message;
}
