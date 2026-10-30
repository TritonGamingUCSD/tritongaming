import { NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/admin';
import { validateSlug } from '@/lib/site/shortLinks';

export const dynamic = 'force-dynamic';

// tritongaming.org/<slug> → wherever that short link points (managed in the portal under Site Content → Links). Real pages like /team win over this,
// since Next matches static routes first.
//
// This is a route, not a page, on purpose: a page would first send the site's navbar, footer and loading screens and only then redirect, which looks
// half loaded. Here the answer is an HTTP redirect before anything is drawn. It is a temporary redirect (307) so changing where a link points takes
// effect straight away instead of being remembered by browsers.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  let slug: string | null = null;
  try {
    slug = validateSlug(decodeURIComponent(raw));
  } catch {
    /* a malformed escape is just not a link */
  }
  if (!slug) return notFoundPage(request);

  const { data } = await createServiceClient().rpc('resolve_short_link', { p_slug: slug });
  if (typeof data !== 'string' || !data) return notFoundPage(request);

  // Internal destinations get a tag so "where did they come from" can credit this short link.
  const target = data.startsWith('/') ? new URL(`${data}${data.includes('?') ? '&' : '?'}utm_source=${encodeURIComponent(slug)}&utm_medium=shortlink`, request.url) : data;
  // Each link says whether search engines may list it (on by default for hiding). One small extra read per click, only to answer that.
  const { data: flag } = await createServiceClient().from('short_links').select('hide_from_search').eq('slug', slug).maybeSingle();
  const res = NextResponse.redirect(target, 307);
  res.headers.set('Cache-Control', 'no-store');
  if (flag?.hide_from_search !== false) res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

// An address that is no short link shows the site's own 404 page (the one for any address that matches nothing), at the address that was typed. A route cannot render a page, so this asks
// for that page once (any address that matches no page will do: /_/not/found) and serves its HTML, without its scripts, for a while, so a bot trying a thousand addresses costs one render, not a thousand.
let poster: { html: string; at: number } | null = null;
async function notFoundPage(request: Request) {
  if (!poster || Date.now() - poster.at > 10 * 60_000) {
    try {
      const res = await fetch(new URL('/_/not/found', request.url), { cache: 'no-store' });
      // The page is plain HTML and CSS that Next streams in: only the few tiny scripts that swap the finished page in for the loading screen are kept ($RB, $RC and the like). The rest belong to the
      // other address and would only try to correct the one in the bar (a reload loop).
      const html = (await res.text())
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (all, body: string) =>
          /^\s*(\$RB=|\$RC\(|\$RC=|\$RX\(|\$RR\(|\$RT=|requestAnimationFrame\(function\(\)\{\$RT)/.test(body) ? all : '',
        )
        .replace(/<link\b[^>]*\b(?:as="script"|rel="modulepreload")[^>]*>/gi, '');
      poster = res.status === 404 ? { html, at: Date.now() } : null;
    } catch {
      poster = null;
    }
  }
  if (!poster) notFound(); // (the page could not be fetched: a plain 404)
  return new Response(poster.html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
