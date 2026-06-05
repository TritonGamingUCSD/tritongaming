import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/types/database';
import { hasRole } from '@/types/database';

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

export async function requireAuth() {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

export async function requireRole(minRole: UserRole): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) throw new Error('Unauthorized');
  if (!hasRole(profile.role, minRole)) throw new Error('Insufficient permissions');
  return profile;
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
