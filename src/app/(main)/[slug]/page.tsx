import { notFound, redirect } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { validateSlug } from '@/lib/site/shortLinks';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false } };

// tritongaming.org/<slug> → wherever that short link points (managed in the
// portal under Site Content → Links). Real pages like /team win over this,
// since Next matches static routes first; unknown slugs get the normal 404.
export default async function ShortLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = validateSlug(decodeURIComponent(raw));
  if (!slug) notFound();

  const { data } = await createPublicClient().rpc('resolve_short_link', { p_slug: slug });
  if (typeof data !== 'string' || !data) notFound();
  // Internal destinations get a tag so "where did they come from" can credit this short link.
  if (data.startsWith('/')) redirect(`${data}${data.includes('?') ? '&' : '?'}utm_source=${encodeURIComponent(slug)}&utm_medium=shortlink`);
  redirect(data);
}
