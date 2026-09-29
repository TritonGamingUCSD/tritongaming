import { createClient } from '@/lib/supabase/server';

// Shared by the portal hub's Photo Albums panel — RLS (see
// 20260920040512_add_photo_albums.sql) already scopes this to
// view_photo_albums holders, so no capability check is needed here beyond
// what the query itself returns (a non-holder just gets zero rows).
export async function getPhotoAlbumsData() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('photo_albums')
    .select('id, title, url, created_by, created_at, sort_order, creator:profiles(display_name)')
    .order('sort_order', { ascending: true });

  if (error) console.error('[photo albums] failed to load:', error);
  return { albums: data ?? [] };
}
