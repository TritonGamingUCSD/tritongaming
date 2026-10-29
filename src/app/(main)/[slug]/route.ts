import { NextResponse } from 'next/server';
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
  if (!slug) return notFoundPage();

  const { data } = await createServiceClient().rpc('resolve_short_link', { p_slug: slug });
  if (typeof data !== 'string' || !data) return notFoundPage();

  // Internal destinations get a tag so "where did they come from" can credit this short link.
  const target = data.startsWith('/') ? new URL(`${data}${data.includes('?') ? '&' : '?'}utm_source=${encodeURIComponent(slug)}&utm_medium=shortlink`, request.url) : data;
  // Each link says whether search engines may list it (on by default for hiding). One small extra read per click, only to answer that.
  const { data: flag } = await createServiceClient().from('short_links').select('hide_from_search').eq('slug', slug).maybeSingle();
  const res = NextResponse.redirect(target, 307);
  res.headers.set('Cache-Control', 'no-store');
  if (flag?.hide_from_search !== false) res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

// A small, self-contained page (no site layout to load), in the site's colours.
function notFoundPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link not found · Triton Gaming</title>
<style>
:root{color-scheme:light dark;--bg:#f2f1f0;--ink:#011941;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#080d1a;--ink:#f2f1f0;--card:#121a30}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:26rem;text-align:center;background:var(--card);border:2px solid var(--ink);border-radius:12px;box-shadow:5px 5px 0 var(--ink);padding:2rem 1.5rem}
h1{margin:0 0 .5rem;font-size:1.5rem}p{margin:0 0 1.25rem;line-height:1.5}
a{display:inline-block;padding:.65rem 1.1rem;border:2px solid #011941;border-radius:999px;background:#ffc72c;color:#011941;font-weight:700;text-decoration:none;box-shadow:3px 3px 0 #011941}
</style></head><body><main><h1>This link doesn’t go anywhere</h1><p>It may have been turned off, or typed a little differently.</p><a href="/">Go to Triton Gaming</a></main></body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
