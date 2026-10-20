import type { SupabaseClient } from '@supabase/supabase-js';
import { adminIds, isRiskyAudit } from '@/lib/notifications/adminAlerts';
import { pushOnly } from '@/lib/notifications/notify';

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
    return;
  }
  // The database put a bell alert in every other admin's list for a risky action; this pushes the same alert to their devices. Never for a throwaway "ZZ" test account.
  try {
    if (!isRiskyAudit(entry)) return;
    const { data: actor } = entry.actorId ? await service.from('profiles').select('display_name').eq('id', entry.actorId).maybeSingle() : { data: null };
    const who = (actor?.display_name as string | undefined) ?? null;
    if (who && /^zz/i.test(who)) return;
    const ids = (await adminIds(service)).filter((id) => id !== entry.actorId);
    await pushOnly(service, ids.map((user_id) => ({ user_id, type: 'audit_alert', title: `Audit alert: ${entry.action} ${entry.entityType}`, body: `${entry.summary}${who ? ` — by ${who}` : ''}`, href: '/portal?section=admin&tab=audit' })));
  } catch (err) {
    console.error('[audit] failed to push alert:', err);
  }
}


// What the scheduled jobs did on their own, so the log answers "who changed this?" with "the daily job" and not a blank. One line per step, and only
// when it actually changed something (a quiet day writes nothing).
export function logSystem(service: SupabaseClient, entityType: string, summary: string, details?: Record<string, unknown>): Promise<void> {
  return logAudit(service, { actorId: null, action: 'automatic', entityType, summary, details });
}
