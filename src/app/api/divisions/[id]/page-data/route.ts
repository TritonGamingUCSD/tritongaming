import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { strictUser } from '@/lib/supabase/localAuth';
import { hasCapability } from '@/lib/portal/capabilities';
import { cleanBlocks } from '@/lib/site/pageBlocks';
import { getCreditPeople } from '@/lib/members/creditPeople';

export const dynamic = 'force-dynamic';

// What the division's Page screen in the portal needs to edit its public page: the saved values and the people who can be credited. For the division's Heads, and exec and admin (the same permission as editing it elsewhere).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user || user.is_anonymous) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_division', id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { data: d } = await supabase
    .from('divisions')
    .select('id, name, slug, description, logo_url, discord_url, application_url, social_links, social_embeds, page_blocks, accent, tagline, banner_url')
    .eq('id', id)
    .maybeSingle();
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    canRename: hasCapability(roles ?? [], 'manage_divisions_directory'),
    creditPeople: await getCreditPeople(supabase).catch(() => []),
    initial: {
      name: d.name,
      slug: d.slug,
      description: d.description ?? '',
      logo_url: d.logo_url ?? '',
      discord_url: d.discord_url ?? '',
      application_url: d.application_url ?? '',
      social_links: d.social_links ?? {},
      social_embeds: d.social_embeds ?? [],
      page_blocks: cleanBlocks(d.page_blocks),
      accent: d.accent ?? '',
      tagline: d.tagline ?? '',
      banner_url: d.banner_url ?? '',
    },
  });
}
