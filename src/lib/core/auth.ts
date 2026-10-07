import { createClient, createRealClient } from '@/lib/supabase/server';
import type { Profile, Capability } from '@/types/database';
import { cookies } from 'next/headers';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/portal/capabilities';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { VIEW_AS_COOKIE, VIEW_USER_COOKIE, isUuid, isViewAsRole, type ViewAsRole } from '@/lib/portal/viewAs';

// The person who is actually signed in (never the one being viewed).
const getSessionUser = cache(async () => {
  const supabase = await createRealClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

// Roles of the signed-in person themselves, straight from the database.
export async function getSessionRoles(): Promise<RoleGrant[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data } = await (await createRealClient()).from('user_roles').select('role, division_id').eq('user_id', user.id);
  return data ?? [];
}

// "View as a specific person": set only by an admin (checked here every time, so a copied cookie does nothing for anyone else).
// While it is set the portal renders as that person and every change is refused (see proxy.ts and ViewOnlyGuard).
export const getViewingUser = cache(async (): Promise<User | null> => {
  const id = (await cookies()).get(VIEW_USER_COOKIE)?.value;
  if (!isUuid(id)) return null;
  const me = await getSessionUser();
  if (!me || me.id === id) return null;
  if (!(await getSessionRoles()).some((r) => r.role === 'admin')) return null;
  const { data } = await createServiceClient().auth.admin.getUserById(id);
  return data?.user ?? null;
});

export async function getUser() {
  return (await getViewingUser()) ?? (await getSessionUser());
}

export async function getProfile(): Promise<Profile | null> {
  const viewing = await getViewingUser();
  const supabase = viewing ? createServiceClient() : await createClient();
  const user = viewing ?? (await getSessionUser());
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

// The signed-in user's own gender (stored in profile_private — owner-only,
// not on the public profiles row).
export async function getMyGender(): Promise<string | null> {
  const viewing = await getViewingUser();
  const supabase = viewing ? createServiceClient() : await createClient();
  const user = viewing ?? (await getSessionUser());
  if (!user) return null;
  const { data } = await supabase.from('profile_private').select('gender').eq('user_id', user.id).maybeSingle();
  return data?.gender ?? null;
}

// Everything stored in the owner-only profile_private row, for the profile form.
export interface MyPrivateProfile {
  gender: string | null;
  platforms: string[];
  favorite_games: string;
  division_interests: string[];
}
export async function getMyPrivateProfile(): Promise<MyPrivateProfile> {
  const empty = { gender: null, platforms: [], favorite_games: '', division_interests: [] };
  const viewing = await getViewingUser();
  const supabase = viewing ? createServiceClient() : await createClient();
  const user = viewing ?? (await getSessionUser());
  if (!user) return empty;
  const { data } = await supabase
    .from('profile_private')
    .select('gender, platforms, favorite_games, division_interests')
    .eq('user_id', user.id)
    .maybeSingle();
  return {
    gender: data?.gender ?? null,
    platforms: data?.platforms ?? [],
    favorite_games: data?.favorite_games ?? '',
    division_interests: data?.division_interests ?? [],
  };
}

// The person's real role grants, straight from the database.
export async function getRealRoles(): Promise<RoleGrant[]> {
  const viewing = await getViewingUser();
  const supabase = viewing ? createServiceClient() : await createClient();
  const user = viewing ?? (await getSessionUser());
  if (!user) return [];

  const { data } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  return data ?? [];
}

// The role an admin is currently previewing ("View as"), or null. Only ever set for a real admin.
export async function getViewAs(): Promise<ViewAsRole | null> {
  if (await getViewingUser()) return null;
  const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!isViewAsRole(value)) return null;
  const real = await getRealRoles();
  return real.some((r) => r.role === 'admin') ? value : null;
}

// The roles the portal should render for. Normally the real ones; while an admin is previewing
// another role, just that role. Page code uses this; API routes check real roles on their own.
export async function getUserRoles(): Promise<RoleGrant[]> {
  const real = await getRealRoles();
  const viewing = await getViewingUser();
  if (viewing) return withGrantedCapabilities(real, await loadGrantedCapabilities(createServiceClient(), viewing.id).catch(() => []));
  const preview = real.some((r) => r.role === 'admin') ? (await cookies()).get(VIEW_AS_COOKIE)?.value : undefined;
  if (!isViewAsRole(preview)) {
    // Plus anything granted to this person or their groups (Admin → Access).
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (!user) return real;
    return withGrantedCapabilities(real, await loadGrantedCapabilities(createServiceClient(), user.id).catch(() => []));
  }
  if (preview === 'guest') return [];
  if (preview === 'division') {
    const supabase = await createClient();
    const { data } = await supabase.from('divisions').select('id').order('name').limit(1);
    return [{ role: 'division', division_id: data?.[0]?.id ?? null }];
  }
  return [{ role: preview, division_id: null }];
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function requireCapability(capability: Capability, divisionId?: string): Promise<RoleGrant[]> {
  const roles = await getUserRoles();
  if (!hasCapability(roles, capability, divisionId)) throw new Error('Insufficient permissions');
  return roles;
}

export async function signInWithGoogle(redirectTo?: string) {
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback${redirectTo ? `?next=${redirectTo}` : ''}`,
    },
  });
}
