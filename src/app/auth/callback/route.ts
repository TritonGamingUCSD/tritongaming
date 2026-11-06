import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { strictUser } from '@/lib/supabase/localAuth';
import { createServiceClient } from '@/lib/supabase/admin';
import { applyPendingGrants } from '@/lib/members/roleByEmail';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/portal';

  // A failed linkIdentity() (e.g. that Google account is already linked
  // to someone else's profile) comes back here the same way any OAuth
  // failure does — a redirect carrying error/error_code instead of a
  // usable code, never a rejected promise back in LinkGoogleSection.tsx
  // (that call already returned once the browser navigated to Google).
  const urlErrorCode = searchParams.get('error_code');
  const urlErrorDescription = searchParams.get('error_description') || searchParams.get('error');

  const supabase = await createClient();

  let exchangeErrorCode: string | undefined;
  let exchangeErrorDescription: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // handle_new_user's 'ucsd' auto-grant only fires on the auth.users
      // INSERT that happens at original signup — linking a ucsd.edu Google
      // account later (LinkGoogleSection.tsx) adds an auth.identities row
      // to the *existing* user, no new auth.users row, so that trigger
      // never runs for it. This re-checks on every callback (sign-in or
      // link) against the user's current full identity list, so the role
      // shows up the moment a ucsd.edu identity actually exists on the
      // account, whichever one that was.
      if (data.user) {
        // Not data.user straight off the exchange — that payload isn't
        // guaranteed to carry the full identities array. A fresh
        // getUser() call is the same authoritative source every other
        // route in this codebase uses for "who is this, completely".
        const {
          data: { user: freshUser },
        } = await strictUser(supabase);
        const hasUcsdIdentity = (freshUser?.identities ?? []).some((identity) => {
          const email = (identity.identity_data?.email as string | undefined) ?? '';
          return email.toLowerCase().endsWith('@ucsd.edu');
        });
        if (hasUcsdIdentity) {
          await createServiceClient().rpc('grant_ucsd_role', { _user_id: data.user.id });
        }

        // Roles that were given by pasting this person's email before they had an account (or before they linked it) are given now.
        const myEmails = [freshUser?.email ?? '', ...(freshUser?.identities ?? []).map((i) => String(i.identity_data?.email ?? ''))];
        await applyPendingGrants(createServiceClient(), data.user.id, myEmails);

        // A linked Discord shows on the person's cards (the Discord line of their social links) so people can be found fast. It only fills an empty line: a handle typed by hand stays, and the card's own "show socials" choice still decides who sees it.
        const discord = (freshUser?.identities ?? []).find((i) => i.provider === 'discord');
        const handle = String(discord?.identity_data?.full_name ?? discord?.identity_data?.name ?? '').trim();
        if (discord) {
          // The account's id and name, for the day a bot or a server role sync needs to find this person.
          const did = String(discord.identity_data?.provider_id ?? discord.identity_data?.sub ?? discord.id ?? '').slice(0, 40);
          if (did)
            await createServiceClient()
              .from('profiles')
              .update({ discord_id: did, discord_username: handle.slice(0, 64) || null })
              .eq('id', data.user.id);
        }
        if (handle) {
          const svc = createServiceClient();
          const { data: prof } = await svc.from('profiles').select('social_links').eq('id', data.user.id).maybeSingle();
          const links = (prof?.social_links ?? {}) as Record<string, string>;
          if (!links.discord)
            await svc
              .from('profiles')
              .update({ social_links: { ...links, discord: handle.slice(0, 64) } })
              .eq('id', data.user.id);
        }

        // Admin-only verification name, kept in sync with whatever Google
        // reports for the identity used this session — separate from the
        // user-editable display_name (see sync_google_name for why this is
        // split server-side rather than duplicating the name-splitting
        // logic here).
        // Only a Google identity's name counts: a Discord name must never end up as the verification name.
        const googleIdentity = (freshUser?.identities ?? []).find((i) => i.provider === 'google');
        const googleFullName = (googleIdentity?.identity_data?.full_name as string | undefined) ?? (googleIdentity?.identity_data?.name as string | undefined);
        if (googleFullName) {
          await createServiceClient().rpc('sync_google_name', { _user_id: data.user.id, _full_name: googleFullName });
        }
      }

      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl);
    }
    exchangeErrorCode = error.code;
    exchangeErrorDescription = error.message;
  }

  const errorCode = urlErrorCode || exchangeErrorCode || 'auth_failed';
  const errorDescription = urlErrorDescription || exchangeErrorDescription;

  // A link attempt (LinkGoogleSection.tsx) fails without ever touching the
  // caller's existing session — if they're still signed in, this wasn't a
  // sign-in attempt at all, so bouncing them to the logged-out /login page
  // would be both wrong and confusing. Send them back to wherever they
  // were (next) with the error attached instead; a genuine failed sign-in
  // (no session either way) keeps going to /login as before.
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const failureTarget = currentUser ? new URL(next, origin) : new URL('/login', origin);
  failureTarget.searchParams.set('error', errorCode);
  if (errorDescription) failureTarget.searchParams.set('error_description', errorDescription);
  return NextResponse.redirect(failureTarget);
}
