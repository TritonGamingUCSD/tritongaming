import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';
import { hasRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import NewPostClient from './NewPostClient';

export const metadata = { title: 'New Post — Board' };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect('/login?next=/board/new');
  if (!hasRole(profile.role, 'member')) redirect('/portal/profile');

  const params = await searchParams;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from('board_categories')
    .select('id, slug, name, icon')
    .eq('is_active', true)
    .order('order_index');

  return (
    <NewPostClient
      categories={categories || []}
      defaultCategory={params.category}
    />
  );
}
