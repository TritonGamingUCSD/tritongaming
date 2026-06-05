import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import MembersClient from './MembersClient';

export const metadata = { title: 'Members' };
export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const profile = await getProfile();
  if (!profile || !hasRole(profile.role, 'exec')) redirect('/portal');

  const supabase = await createClient();
  const [{ data: profiles }, { data: requests }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, role, gamer_tag, created_at')
      .neq('role', 'guest')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('member_requests')
      .select(`
        id, requested_role, message, status, created_at,
        user:profiles(id, display_name, avatar_url)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  return (
    <MembersClient
      members={(profiles ?? []) as unknown as Parameters<typeof MembersClient>[0]['members']}
      requests={(requests ?? []) as unknown as Parameters<typeof MembersClient>[0]['requests']}
      isAdmin={hasRole(profile.role, 'admin')}
    />
  );
}
