import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Server routes that act with the service role (so database triggers can't tell
// who is behind them) record their sensitive actions here — see audit_log and
// log_audit() in 20261002060000_audit_log.sql. Best-effort by design: a failure
// to write the log line must never undo or block the action that already succeeded.
export async function logAudit(
  service: SupabaseClient,
  entry: {
    actorId: string | null;
    action: string;            // e.g. "delete", "merge", "reverse"
    entityType: string;        // e.g. "account", "points", "check-in"
    entityId?: string | null;
    summary: string;
    details?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    await service.rpc('log_audit', {
      p_actor: entry.actorId,
      p_action: entry.action,
      p_entity_type: entry.entityType,
      p_entity_id: entry.entityId ?? null,
      p_summary: entry.summary,
      p_details: entry.details ?? null,
    });
  } catch (err) {
    console.error('[audit] failed to record entry:', err);
  }
}

// For routes whose auth helper doesn't hand back the user id.
export async function currentActorId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}
