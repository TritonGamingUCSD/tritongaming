import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { invalidate } from '@/lib/site/revalidate';
import { createServiceClient } from '@/lib/supabase/admin';
import { getOffSwitches } from '@/lib/portal/featureServer';
import { blockedMessage, isBlocked, type Term } from './filter';

// The lists, read once and kept a minute (tag 'wordfilter', refreshed when an admin edits them). If the read fails nothing is blocked: a database hiccup must never stop people from saving.
export async function loadTerms(): Promise<Term[]> {
  try {
    return await unstable_cache(
      async () => {
        const { data, error } = await createServiceClient().from('word_filter_terms').select('term, kind, partial');
        if (error) throw error;
        return (data ?? []).map((r) => ({ term: r.term as string, kind: r.kind as 'block' | 'allow', partial: !!r.partial }));
      },
      ['word-filter-terms'],
      { revalidate: 60, tags: ['wordfilter'] },
    )();
  } catch {
    return [];
  }
}
export const refreshTerms = () => invalidate('wordfilter');

// The first line of a route that saves words anyone can read: `const bad = await refuseBlocked({ Title: title, Description: body }); if (bad) return bad;`.
// Answers 422 naming the field (never the word) when something is blocked, and null when everything is fine or the filter is off.
export async function refuseBlocked(fields: Record<string, string | null | undefined>): Promise<NextResponse | null> {
  if ((await getOffSwitches()).includes('word_filter')) return null;
  const terms = await loadTerms();
  if (terms.length === 0) return null;
  for (const [label, value] of Object.entries(fields)) if (isBlocked(value, terms)) return NextResponse.json({ error: blockedMessage(label), field: label }, { status: 422 });
  return null;
}
