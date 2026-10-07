import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { MAX_ACCOUNTS, clearExternalCache, emailFromIdToken, encryptToken, exchangeCode, googleConfigured, onlyViewScopes, revokeToken, siteOrigin } from '@/lib/events/googleCalendar';

export const dynamic = 'force-dynamic';

// Step two: Google sends the member back here with a one-time code. It is exchanged for a refresh token (stored encrypted), and only if
// they kept the calendar permission ticked.
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request);
  const back = (code: string) => {
    const res = NextResponse.redirect(`${origin}/portal/calendar?gcal=${code}`);
    res.cookies.delete({ name: 'gcal_state', path: '/api/calendar/google' });
    return res;
  };
  const q = new URL(request.url).searchParams;
  if (q.get('error')) return back('denied');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!googleConfigured()) return back('not_configured');
  const state = q.get('state'), cookieState = request.cookies.get('gcal_state')?.value;
  if (!state || !cookieState || state !== cookieState) return back('failed');
  const code = q.get('code');
  if (!code) return back('failed');

  const t = await exchangeCode(code, origin);
  const refresh = t.json.refresh_token as string | undefined;
  if (!t.ok || !refresh) return back('failed');
  // They can untick the calendar box on Google's screen (then nothing is linked), and anything beyond view-only is refused and revoked.
  const scope = String(t.json.scope ?? '');
  if (!onlyViewScopes(scope)) { await revokeToken(refresh); return back(scope.split(' ').includes('https://www.googleapis.com/auth/calendar.events.readonly') ? 'failed' : 'no_scope'); }
  const email = emailFromIdToken(t.json.id_token)?.toLowerCase();
  if (!email) { await revokeToken(refresh); return back('failed'); }

  const svc = createServiceClient();
  const { data: mine } = await svc.from('calendar_connections').select('id, google_email').eq('user_id', user.id);
  const existing = (mine ?? []).find((c) => (c.google_email as string).toLowerCase() === email);
  if (!existing && (mine ?? []).length >= MAX_ACCOUNTS) { await revokeToken(refresh); return back('too_many'); }
  const row = { refresh_token_enc: encryptToken(refresh), scope, connected_at: new Date().toISOString(), last_error: null };
  const { error } = existing
    ? await svc.from('calendar_connections').update(row).eq('id', existing.id)
    : await svc.from('calendar_connections').insert({ user_id: user.id, provider: 'google', google_email: email, ...row });
  if (error) return back('failed');
  clearExternalCache();
  return back('linked');
}
