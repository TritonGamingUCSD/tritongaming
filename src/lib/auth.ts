import { createClient } from '@/lib/supabase/server';
import type { Profile, Capability } from '@/types/database';
import { hasCapability, type RoleGrant } from '@/lib/capabilities';

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

export async function getUserRoles(): Promise<RoleGrant[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_roles')
    .select('role, division_id')
    .eq('user_id', user.id);

  return data ?? [];
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
