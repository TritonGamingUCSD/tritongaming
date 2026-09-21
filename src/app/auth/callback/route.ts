import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/portal';
  const ref = searchParams.get('ref');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Only ever sets referred_by, never overwrites it — a returning
      // member re-authenticating through an old bookmarked referral link
      // shouldn't have their original referrer silently swapped out.
      // handle_new_user's trigger has already created the profile row by
      // this point (it fires on the auth.users insert, which just
      // happened as part of exchangeCodeForSession), so this is purely a
      // best-effort enrichment, not something the signup itself depends on.
      if (ref && data.user) {
        const serviceClient = createServiceClient();
        const { data: referrer } = await serviceClient
          .from('profiles')
          .select('id')
          .eq('referral_code', ref.toUpperCase())
          .maybeSingle();

        if (referrer && referrer.id !== data.user.id) {
          await serviceClient
            .from('profiles')
            .update({ referred_by: referrer.id })
            .eq('id', data.user.id)
            .is('referred_by', null);
        }
      }

      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_failed', origin));
}
