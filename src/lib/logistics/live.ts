import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Telling everyone who has the Prizing page open that something changed, so they see it within a second or two (the page also asks now and then, so a lost message only delays it).
// Messages go on two channels: one per event (`logi-<plan id>`, which nobody can guess) for what happens inside an event, and one for the prize stock (`logi-stock-<hash>`, the hash comes from a
// server secret and is handed to the page by the prize list). A message is small and public: ids and numbers, and the name of who did it.
export const planTopic = (planId: string) => `logi-${planId}`;
export const stockTopic = () =>
  `logi-stock-${createHash('sha256')
    .update(`logistics-stock:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`)
    .digest('hex')
    .slice(0, 20)}`;

export type LiveMsg =
  | { k: 'line'; plan: string; line: string; station: string; prize: string; qty: number; was: number } // a station's number for a prize (0 = taken off)
  | { k: 'count'; plan: string; line: string; step: string; done: number } // an event-day counter
  | { k: 'stock'; prize: string; qty: number; was: number } // the number on hand
  | { k: 'prizes' } // prizes were added, edited or removed: ask for the list again
  | { k: 'plan'; plan: string }; // the makeup of the event changed (stations, status…): ask for the event again
export type LiveEnvelope = LiveMsg & { uid: string | null; by: string | null; at: number };

export async function announce(topic: string, msg: LiveMsg, who?: { id: string | null; name: string | null }): Promise<void> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return;
  try {
    const payload: LiveEnvelope = { ...msg, uid: who?.id ?? null, by: who?.name ?? null, at: Date.now() };
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: AbortSignal.timeout(2500),
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event: 'change', payload, private: false }] }),
    });
  } catch {
    /* the page catches up on its own */
  }
}

// The name shown for someone's changes: their display name, "Someone" if they have none.
export async function whoIs(svc: SupabaseClient, userId: string): Promise<{ id: string; name: string }> {
  const { data } = await svc.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  return { id: userId, name: (data?.display_name as string | undefined)?.trim() || 'Someone' };
}
