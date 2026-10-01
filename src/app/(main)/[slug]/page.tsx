import { notFound, redirect } from 'next/navigation';
import { createPublicClient } from '@/lib/supabase/public';
import { validateSlug } from '@/lib/shortLinks';

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
  redirect(data);
}
