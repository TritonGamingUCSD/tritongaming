import { createClient } from '@/lib/supabase/server';
import type { Profile, Capability } from '@/types/database';
import { cookies } from 'next/headers';
import { hasCapability, withGrantedCapabilities, type RoleGrant } from '@/lib/capabilities';
import { createServiceClient } from '@/lib/supabase/admin';
import { loadGrantedCapabilities } from '@/lib/grantedCapabilities';
import { VIEW_AS_COOKIE, isViewAsRole, type ViewAsRole } from '@/lib/viewAs';

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  return data ?? [];
}

// The role an admin is currently previewing ("View as"), or null. Only ever set for a real admin.
export async function getViewAs(): Promise<ViewAsRole | null> {
  const value = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!isViewAsRole(value)) return null;
  const real = await getRealRoles();
  return real.some((r) => r.role === 'admin') ? value : null;
}

// The roles the portal should render for. Normally the real ones; while an admin is previewing
// another role, just that role. Page code uses this; API routes check real roles on their own.
export async function getUserRoles(): Promise<RoleGrant[]> {
  const real = await getRealRoles();
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
