import type { SupabaseClient } from '@supabase/supabase-js';

// A poll, Q&A, Trivia game, photo booth or Staffle can be made for an event (optional). This reads what a screen sent: nothing (or an empty value) means "not for an event" and undefined means "leave it as it is"; an event that does not exist is refused.
export async function eventLink(svc: SupabaseClient, raw: unknown): Promise<{ ok: true; id: string | null | undefined } | { ok: false }> {
  if (raw === undefined) return { ok: true, id: undefined };
  if (raw === null || raw === '') return { ok: true, id: null };
  if (typeof raw !== 'string' || !/^[0-9a-f-]{36}$/i.test(raw)) return { ok: false };
  const { data } = await svc.from('events').select('id').eq('id', raw).maybeSingle();
  return data ? { ok: true, id: raw } : { ok: false };
}
export const NO_SUCH_EVENT = 'That event is gone.';
