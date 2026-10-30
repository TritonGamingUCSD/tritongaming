import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { validateSlug } from '@/lib/site/shortLinks';

export const dynamic = 'force-dynamic';

// Where a short link (tritongaming.org/<slug>) goes, WITHOUT counting a click: the portal's Scan page asks before it opens a short link that leaves this site (it then opens the link itself, which counts).
//   GET /api/links/peek?slug=<slug>  →  { kind: 'none' }                      not a short link (a page of the site, or nothing)
//                                       { kind: 'inside' }                    it goes to a page of this site
//                                       { kind: 'outside', host, url }        it goes to another website
export async function GET(request: Request) {
  const slug = validateSlug(new URL(request.url).searchParams.get('slug') ?? '');
  if (!slug) return NextResponse.json({ kind: 'none' });
  const { data } = await createServiceClient().from('short_links').select('destination').eq('slug', slug).eq('is_active', true).maybeSingle();
  const to = data?.destination as string | undefined;
  if (!to) return NextResponse.json({ kind: 'none' }, { headers: { 'Cache-Control': 'no-store' } });
  if (to.startsWith('/')) return NextResponse.json({ kind: 'inside' }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const u = new URL(to);
    if (/(^|\.)tritongaming\.org$/i.test(u.hostname)) return NextResponse.json({ kind: 'inside' }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ kind: 'outside', host: u.hostname, url: u.href }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ kind: 'none' }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
