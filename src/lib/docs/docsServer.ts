import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { staffName } from '@/lib/members/names';
import type { SupabaseClient } from '@supabase/supabase-js';

// 'manage_docs' = lead, exec, admin (write); 'view_docs' = everyone who can read the docs. The routes use the service client, so this is the real boundary.
export async function authorizeDocs(capability: 'manage_docs' | 'view_docs') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const svc = createServiceClient();
  const grants = withGrantedCapabilities(roles ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!hasCapability(grants, capability)) {
    return { error: NextResponse.json({ error: capability === 'manage_docs' ? 'Only leads, exec and admins can edit docs.' : 'The docs are for the team.' }, { status: 403 }) };
  }
  return { user, svc, roles: grants };
}

export const UUID = /^[0-9a-f-]{36}$/i;
export const MAX_DOC_CHARS = 200_000;
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const DOC_COLUMNS = 'id, slug, title, category_id, parent_id, order_index, content, attachments, created_by, updated_by, created_at, updated_at, icon, cover_url, tags, pinned, pin_order, published, revision';
export const DRAFT_COLUMNS = 'draft_title, draft_content, draft_updated_at, draft_updated_by';

export const EDITING_WINDOW_MS = 60_000;
// Display names for a set of people (service client).
export async function namesOf(svc: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map();
  const { data } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', list);
  return new Map((data ?? []).map((p) => [p.id as string, staffName(p as never)]));
}
// Who (other than `me`) has these docs open in the editor right now: doc id -> names.
export async function editingNow(svc: SupabaseClient, docIds: string[], me: string): Promise<Map<string, string[]>> {
  if (!docIds.length) return new Map();
  const { data } = await svc.from('doc_editing').select('doc_id, user_id').in('doc_id', docIds).neq('user_id', me).gte('last_seen', new Date(Date.now() - EDITING_WINDOW_MS).toISOString());
  const names = await namesOf(svc, (data ?? []).map((r) => r.user_id as string));
  const out = new Map<string, string[]>();
  for (const r of data ?? []) out.set(r.doc_id as string, [...(out.get(r.doc_id as string) ?? []), names.get(r.user_id as string) ?? 'Someone']);
  return out;
}
