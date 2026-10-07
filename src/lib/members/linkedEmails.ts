import type { SupabaseClient } from '@supabase/supabase-js';

export interface LinkedEmail {
  provider: string;
  email: string;
}

// Staff-facing views show every email a member can sign in with (the old "preferred email" choice is gone).
export function pickDisplayEmails(linkedEmails: LinkedEmail[], _preferredEmail?: string | null): LinkedEmail[] {
  return linkedEmails;
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
