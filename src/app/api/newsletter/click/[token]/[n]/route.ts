import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/email/template';

export const dynamic = 'force-dynamic';

// A link in a sent issue: it counts the click for that link (one number per link, never who clicked) and sends the person on. An unknown token or number goes to the site's home page instead of failing.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; n: string }> }) {
  const { token, n } = await params;
  const num = Number(n);
  const svc = createServiceClient();
  if (/^[0-9a-f]{32}$/.test(token) && Number.isInteger(num) && num > 0 && num < 1000) {
    const { data: issue } = await svc.from('newsletter_issues').select('id').eq('web_token', token).maybeSingle();
    if (issue) {
      const { data: url } = await svc.rpc('newsletter_click', { p_issue: issue.id, p_n: num });
      if (typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(url)) return NextResponse.redirect(url, 302);
    }
  }
  return NextResponse.redirect(siteUrl(), 302);
}
