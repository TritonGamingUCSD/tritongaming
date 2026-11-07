import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { hasCapability, withGrantedCapabilities } from '@/lib/portal/capabilities';
import { staffName } from '@/lib/members/names';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canEditClubDoc, canReadClubDoc, type AccessContext, type AccessEntry, type ClubDocLists } from './access';

// 'manage_docs' = lead, exec, admin (write); 'view_docs' = everyone who can read the docs. The routes use the service client, so this is the real boundary.
export async function authorizeDocs(capability: 'manage_docs' | 'view_docs') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
export const DOC_COLUMNS =
  'id, slug, title, category_id, parent_id, order_index, content, created_by, updated_by, created_at, updated_at, icon, cover_url, tags, pinned, pin_order, published, revision, teams, reviewed_at, reviewed_by';
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
  const { data } = await svc
    .from('doc_editing')
    .select('doc_id, user_id')
    .in('doc_id', docIds)
    .neq('user_id', me)
    .gte('last_seen', new Date(Date.now() - EDITING_WINDOW_MS).toISOString());
  const names = await namesOf(
    svc,
    (data ?? []).map((r) => r.user_id as string),
  );
  const out = new Map<string, string[]>();
  for (const r of data ?? []) out.set(r.doc_id as string, [...(out.get(r.doc_id as string) ?? []), names.get(r.user_id as string) ?? 'Someone']);
  return out;
}

// ── Per-doc access ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface DocActor {
  userId: string;
  ctx: AccessContext;
  hasView: boolean;
  hasManage: boolean;
  staff: boolean;
}

/** Everything needed to ask "may this person read or edit this doc?": their roles (with granted permissions), teams and the two permissions that decide a doc with no lists. */
export async function loadDocActor(svc: SupabaseClient, userId: string): Promise<DocActor> {
  const [{ data: roles }, granted, { data: groups }] = await Promise.all([
    svc.from('user_roles').select('role, division_id').eq('user_id', userId),
    loadGrantedCapabilities(svc, userId).catch(() => []),
    svc.from('meeting_groups').select('id').contains('member_ids', [userId]),
  ]);
  const grants = withGrantedCapabilities(roles ?? [], granted);
  const staff = grants.some((r) => r.role === 'exec' || r.role === 'admin');
  return {
    userId,
    ctx: { userId, roles: grants, teamIds: (groups ?? []).map((g) => g.id as string) },
    hasView: hasCapability(grants, 'view_docs'),
    hasManage: hasCapability(grants, 'manage_docs'),
    staff,
  };
}

export type DocListsRow = { id: string; read_access: AccessEntry[] | null; edit_access: AccessEntry[] | null };
export const DOC_LIST_COLUMNS = 'id, read_access, edit_access';

export const docCan = (a: DocActor, d: ClubDocLists) => ({ read: canReadClubDoc(d, a.ctx, a.hasView), edit: canEditClubDoc(d, a.ctx, a.hasManage) });

/**
 * For a route about one doc: the person, whether they may read / edit it, and the doc's lists. `mode` is what the route needs: 'read' or 'edit'.
 * A doc that does not exist, or that they cannot read, is "not found" for a reader, and a doc they can read but not change says so. Nobody is told a doc they cannot read exists, except through the request-access route.
 */
export async function authorizeDoc(docId: string, mode: 'read' | 'edit') {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const svc = createServiceClient();
  if (!UUID.test(docId)) return { error: bad('Doc not found.', 404) } as const;
  const [actor, { data: lists }] = await Promise.all([loadDocActor(svc, user.id), svc.from('docs').select(DOC_LIST_COLUMNS).eq('id', docId).maybeSingle()]);
  if (!lists) return { error: NextResponse.json({ error: 'This doc was deleted or moved out of reach.', code: 'deleted' }, { status: 404 }) } as const;
  const can = docCan(actor, lists as unknown as ClubDocLists);
  const readOk = can.read || can.edit;
  if (!readOk) return { error: NextResponse.json({ error: 'This doc was deleted or moved out of reach.', code: 'deleted' }, { status: 404 }) } as const;
  if (mode === 'edit' && !can.edit) return { error: NextResponse.json({ error: 'You can read this doc but not change it.', code: 'read_only' }, { status: 403 }) } as const;
  return { user, svc, actor, can, lists: lists as unknown as DocListsRow } as const;
}
