import type { SupabaseClient } from '@supabase/supabase-js';

export interface LinkedEmail {
  provider: string;
  email: string;
}

// A member can choose one of their linked emails as "preferred" (see
// LinkGoogleSection.tsx) — staff-facing views show only that one instead
// of every linked email once it's set. Falls back to showing everything
// linked if no preference is set, or if the preferred one somehow isn't
// among the currently-linked emails anymore (e.g. that identity was
// unlinked after the preference was saved).
export function pickDisplayEmails(linkedEmails: LinkedEmail[], preferredEmail?: string | null): LinkedEmail[] {
  if (!preferredEmail) return linkedEmails;
  const match = linkedEmails.find((e) => e.email === preferredEmail);
  return match ? [match] : linkedEmails;
}

// Batched lookup of every email a set of users can sign in with — see
// get_linked_emails in 20260922010000_add_get_linked_emails.sql for why
// this has to be an RPC (auth.identities isn't reachable through
// PostgREST, and auth.admin.listUsers() doesn't include `identities` the
// way auth.admin.getUserById() does, so a per-user Admin API call for a
// list of hundreds isn't practical). serviceClient must be a service-role
// client — the RPC is revoked from anon/authenticated.
export async function fetchLinkedEmails(serviceClient: SupabaseClient, userIds: string[]): Promise<Map<string, LinkedEmail[]>> {
  const byUser = new Map<string, LinkedEmail[]>();
  if (userIds.length === 0) return byUser;

  const { data, error } = await serviceClient.rpc('get_linked_emails', { _user_ids: userIds });
  if (error) {
    console.error('[linkedEmails] failed to load:', error);
    return byUser;
  }

  for (const row of (data ?? []) as { user_id: string; provider: string; email: string }[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({ provider: row.provider, email: row.email });
    byUser.set(row.user_id, list);
  }
  return byUser;
}
