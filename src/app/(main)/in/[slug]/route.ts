import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// tritongaming.org/in/<event> is the short link printed on the self check-in QR. It only forwards to the portal page, which handles signing in and then
// returns to the check-in. Kept as a short, plain route so the QR code stays simple and scans fast.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clean = decodeURIComponent(slug)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 120);
  const res = NextResponse.redirect(new URL(`/portal/in/${clean}`, request.url), 307);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
