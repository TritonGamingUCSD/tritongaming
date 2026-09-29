import { createClient } from '@/lib/supabase/server';

// Shared by the standalone /portal/divisions route and the portal hub.
export async function getDivisionsData() {
  const supabase = await createClient();
  const { data: divisions } = await supabase
    .from('divisions')
    .select('id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds')
    .order('name', { ascending: true });

  return { divisions: divisions ?? [] };
}
