import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { AUDIENCE_ROLES } from '@/lib/meetings/meetingAudience';
import { staffName } from '@/lib/members/names';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole, type Capability } from '@/types/database';

// Storage keys: which keys the club has and where each one is right now. A key is held by a member, by someone outside the club, or
// is simply somewhere (a place). Anyone on the key team can say they have a key or record handing one over; every move is kept. Only exec and
// admin can add, rename or delete a key.

export const KEY_COLORS = ['#ffc72c', '#fb923c', '#f87171', '#f472b6', '#a78bfa', '#60a5fa', '#2dd4bf', '#34d399'] as const;
export type HolderKind = 'member' | 'person' | 'place';
export interface Holder { kind: HolderKind; user_id: string | null; label: string | null; note: string | null }

export async function authorizeKeys(capability: Extract<Capability, 'view_keys' | 'manage_keys'> = 'view_keys') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = roles ?? [];
  if (!hasCapability(grants, capability)) return { error: NextResponse.json({ error: capability === 'manage_keys' ? 'Only exec and admins can add, change or remove keys.' : 'Storage keys are for the team.' }, { status: 403 }) };
  return { user, roles: grants, svc: createServiceClient(), manageAll: hasCapability(grants, 'manage_keys') };
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Everyone a key can be handed to inside the club: the team (exec, lead, officer, recruit).
export interface KeyPerson { id: string; name: string; avatar_url: string | null; role: string }
export async function keyPeople(svc: SupabaseClient): Promise<KeyPerson[]> {
  const { data: grants } = await svc.from('user_roles').select('user_id, role').in('role', [...AUDIENCE_ROLES]);
  const rolesOf = new Map<string, AppRole[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), g.role as AppRole]);
  const ids = [...rolesOf.keys()];
  if (!ids.length) return [];
  const { data: profiles } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', ids);
  return (profiles ?? []).map((p) => {
    const top = [...(rolesOf.get(p.id as string) ?? [])].sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return { id: p.id as string, name: staffName(p), avatar_url: resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }), role: top ? ROLE_LABELS[top] : '' };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

// Check who a key is being given to: a member on the team, an outsider's name, or a place.
export function parseHolder(input: unknown, people: Set<string>): { ok: true; holder: Holder } | { ok: false; error: string } {
  const b = (input ?? {}) as Record<string, unknown>;
  const note = clean(b.note, 200) || null;
  if (b.kind === 'member') {
    const id = clean(b.user_id, 40);
    if (!people.has(id)) return { ok: false, error: 'Pick someone on the team.' };
    return { ok: true, holder: { kind: 'member', user_id: id, label: null, note } };
  }
  if (b.kind === 'person' || b.kind === 'place') {
    const label = clean(b.label, 80);
    if (!label) return { ok: false, error: b.kind === 'person' ? 'Who has it? Enter their name.' : 'Where is it? Enter the place.' };
    return { ok: true, holder: { kind: b.kind, user_id: null, label, note } };
  }
  return { ok: false, error: 'Say who has the key, or where it is.' };
}

export interface KeyItem {
  id: string; name: string; color: string;
  holder: { kind: HolderKind; user_id: string | null; name: string; avatar_url: string | null; note: string | null };
  held_since: string; updated_at: string; created_by: string | null; canEdit: boolean; mine: boolean;
}

export async function listKeys(svc: SupabaseClient, me: { id: string }, manageAll: boolean, people?: KeyPerson[]): Promise<KeyItem[]> {
  const { data } = await svc.from('storage_keys').select('*').order('name');
  const who = new Map((people ?? await keyPeople(svc)).map((p) => [p.id, p]));
  // A holder who has since left the team still needs a name.
  const missing = [...new Set((data ?? []).map((k) => k.holder_user_id as string | null).filter((id): id is string => !!id && !who.has(id)))];
  const extra = new Map<string, { name: string; avatar_url: string | null }>();
  if (missing.length) {
    const { data: ps } = await svc.from('profiles').select('id, display_name, google_first_name, google_last_name, avatar_url, custom_avatar_url').in('id', missing);
    for (const p of ps ?? []) extra.set(p.id as string, { name: staffName(p), avatar_url: resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }) });
  }
  return (data ?? []).map((k) => {
    const uid = k.holder_user_id as string | null;
    const p = uid ? (who.get(uid) ?? extra.get(uid)) : null;
    return {
      id: k.id, name: k.name, color: k.color,
      holder: { kind: k.holder_kind, user_id: uid, name: k.holder_kind === 'member' ? (p?.name ?? 'Unknown member') : (k.holder_label ?? ''), avatar_url: p?.avatar_url ?? null, note: k.holder_note },
      held_since: k.held_since, updated_at: k.updated_at, created_by: k.created_by, canEdit: manageAll, mine: uid === me.id,
    } as KeyItem;
  });
}

// Which keys each member holds, for the little key icons on the members list.
export async function keysByHolder(svc: SupabaseClient): Promise<Record<string, { id: string; name: string; color: string }[]>> {
  const { data } = await svc.from('storage_keys').select('id, name, color, holder_user_id').eq('holder_kind', 'member').not('holder_user_id', 'is', null);
  const out: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const k of data ?? []) (out[k.holder_user_id as string] ??= []).push({ id: k.id as string, name: k.name as string, color: k.color as string });
  return out;
}

// How a holder reads in a sentence ("Eric", "someone outside the club (Sam)", "at the storage closet").
export const holderText = (h: { kind: HolderKind; name: string }) => (h.kind === 'member' ? h.name : h.kind === 'person' ? `${h.name} (outside the club)` : `at ${h.name}`);
