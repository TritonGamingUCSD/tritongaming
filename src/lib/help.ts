import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { createNotifications } from '@/lib/notify';

export * from '@/lib/helpConstants';
import { MAX_ATTACHMENTS, type HelpCategory, type HelpStatus } from '@/lib/helpConstants';

export interface HelpTicketRow {
  id: string; user_id: string; category: HelpCategory; subject: string; status: HelpStatus; assigned_to: string | null;
  page: string | null; user_agent: string | null; created_at: string; updated_at: string; resolved_at: string | null; last_from_user: boolean;
}
export interface HelpMessageRow { id: string; ticket_id: string; author_id: string; body: string; attachments: string[]; created_at: string }

export async function authorizeHelp() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  return { user, svc: createServiceClient(), isStaff: hasCapability(roles ?? [], 'manage_help'), canGrantRoles: hasCapability(roles ?? [], 'manage_roles') };
}

// Only paths inside the sender's own folder of the help bucket are accepted.
export function cleanAttachments(raw: unknown, userId: string): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === 'string' && p.startsWith(`${userId}/`) && !p.includes('..') && p.length < 200).slice(0, MAX_ATTACHMENTS);
}

export async function signAttachments(svc: SupabaseClient, paths: string[]): Promise<{ path: string; url: string }[]> {
  if (paths.length === 0) return [];
  const { data } = await svc.storage.from('help-attachments').createSignedUrls(paths, 3600);
  return (data ?? []).flatMap((d) => (d.signedUrl && d.path ? [{ path: d.path, url: d.signedUrl }] : []));
}

export async function staffIds(svc: SupabaseClient): Promise<string[]> {
  const { data } = await svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']);
  return [...new Set((data ?? []).map((r) => r.user_id as string))];
}

export async function notify(svc: SupabaseClient, userIds: string[], n: { title: string; body: string; href: string }) {
  if (userIds.length === 0) return;
  await createNotifications(svc, userIds.map((user_id) => ({ user_id, type: 'help_ticket', title: n.title, body: n.body, href: n.href })));
}

// "Chrome on macOS" from a user-agent string — enough to reproduce a problem.
export function describeAgent(ua: string | null | undefined): string {
  const s = ua ?? '';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /(CriOS|Chrome)\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Unknown browser';
  const os = /iPhone|iPad/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : 'unknown OS';
  return `${browser} on ${os}`;
}
