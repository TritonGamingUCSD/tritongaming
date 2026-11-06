'use client';

import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { UserIdentity } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { showToast } from '@/lib/ui/toast';
import { createClient } from '@/lib/supabase/client';
import styles from './profile.module.css';
import Button from '@/components/ui/Button';

// Error codes auth/callback/route.ts can hand back after a failed
// linkIdentity() redirect round-trip — see that route's own comment for
// why this can't just be a rejected promise like a normal API call.
const LINK_ERROR_MESSAGES: Record<string, string> = {
  identity_already_exists:
    'That account is already linked to a different profile. If it is your own, sign out and sign in with it directly, then connect the other one from your profile.',
  manual_linking_disabled: 'Account linking isn’t turned on for this site yet — an admin needs to enable "Manual linking" in Supabase’s Auth settings.',
};

// Sign-in here is Google OAuth only (see login/page.tsx) — for most members
// that's fine indefinitely, but UC San Diego deletes @ucsd.edu Google
// accounts some time after graduation, which would otherwise permanently
// lock an alumnus out of their own account (their profile, past tickets,
// activity history — all of it, since it's all keyed to that same auth
// user id). supabase.auth.linkIdentity attaches a *second* Google account
// (e.g. a personal Gmail) to the same account without disturbing the
// existing one — Supabase matches by the Google identity itself at sign-in,
// not by which button was clicked, so the sign-in buttons on the login
// page works with either account afterward. No password to set or manage
// (an earlier version of this feature used an email+password backup
// credential instead — removed in favor of this, so there's only ever one
// sign-in mechanism to reason about).
//
// Requires the Supabase project's "Manual linking" Auth setting to be on
// (Dashboard → Authentication → Sign In / Providers → Auth Providers →
// Allow manual linking) — a project-level toggle outside what a migration
// or this code can turn on. If it's off, linkIdentity() redirects to
// Google and then fails on the way back with "Manual linking is disabled"
// — surfaced as a normal error here, not a silent failure. Same
// requirement for unlinkIdentity() below.
export default function LinkGoogleSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // A failed link attempt lands back here (still on this tab — see
  // auth/callback/route.ts) as ?error=&error_description= rather than a
  // promise rejection, since the browser fully navigated away to Google
  // and back in between. Read once, then strip it from the URL so a
  // refresh doesn't keep re-showing a stale error.
  useEffect(() => {
    const code = searchParams.get('error');
    if (!code) return;
    const description = searchParams.get('error_description');
    setError(LINK_ERROR_MESSAGES[code] || description || 'Failed to link that account. Please try again.');
    const cleaned = new URLSearchParams(searchParams.toString());
    cleaned.delete('error');
    cleaned.delete('error_description');
    router.replace(`/portal?${cleaned.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadIdentities() {
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.getUserIdentities();
    if (!err && data) setIdentities(data.identities);
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await loadIdentities();
    })();
  }, []);

  function emailOf(identity: UserIdentity): string {
    const d = identity.identity_data ?? {};
    const mail = (d.email as string | undefined) ?? '';
    if (identity.provider === 'discord') return `Discord: ${(d.full_name as string | undefined) || (d.name as string | undefined) || mail || 'connected'}`;
    return mail;
  }

  async function handleLink(provider: 'google' | 'discord' = 'google') {
    setError('');
    setLinking(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.linkIdentity({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/portal/profile/security')}`,
        ...(provider === 'discord' ? { scopes: 'identify email' } : {}),
      },
    });
    // On success this navigates away to Google's consent screen — setLinking(false)
    // only actually runs if it failed before that redirect happened.
    if (err) {
      setError(err.message || 'Failed to start linking. Please try again.');
      setLinking(false);
    }
  }

  // Use the picture of a linked Discord account as the profile picture.
  async function useDiscordPicture(identity: UserIdentity) {
    const url = String(identity.identity_data?.avatar_url ?? '');
    if (!/^https:\/\/cdn\.discordapp\.com\//.test(url)) {
      setError('That Discord account has no picture to use.');
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from('profiles').update({ custom_avatar_url: url }).eq('id', user.id);
    setError(err ? 'Could not change your picture. Try again.' : '');
    if (!err) showToast('Your Discord picture is now your profile picture');
  }

  async function handleUnlink(identity: UserIdentity) {
    const email = emailOf(identity);
    if (!(await confirmHold({ title: `Unlink ${email}?`, message: "You'll no longer be able to sign in with that account.", confirmLabel: 'Hold to unlink' }))) return;
    setError('');
    setUnlinkingId(identity.identity_id);
    const supabase = createClient();
    const { error: err } = await supabase.auth.unlinkIdentity(identity);
    setUnlinkingId(null);
    if (err) {
      setError(err.message || 'Failed to unlink. Please try again.');
      return;
    }
    await loadIdentities();
  }

  // Supabase refuses to unlink someone's only remaining identity (you'd be
  // left with no way to sign in at all) — matched here so the button
  // reads as unavailable instead of clicking through to a server error.
  const canUnlink = (identities?.length ?? 0) > 1;

  return (
    <div className={styles.backupLoginSection}>
      <h2 className={styles.backupLoginTitle}>Linked Accounts</h2>

      {identities && identities.length > 0 && (
        <ul className={styles.identityList}>
          {identities.map((i) => (
            <li key={i.identity_id} className={styles.identityRow}>
              <span>{emailOf(i)}</span>
              {i.provider === 'discord' && /^https:\/\/cdn\.discordapp\.com\//.test(String(i.identity_data?.avatar_url ?? '')) && (
                <button type="button" className={styles.unlinkBtn} style={{ width: 'auto', padding: '0 0.6rem' }} onClick={() => useDiscordPicture(i)}>
                  Use as my picture
                </button>
              )}
              {canUnlink && (
                <button type="button" className={styles.unlinkBtn} onClick={() => handleUnlink(i)} disabled={unlinkingId === i.identity_id} aria-label={`Unlink ${emailOf(i)}`}>
                  {unlinkingId === i.identity_id ? '…' : <X size={13} strokeWidth={1.75} aria-hidden="true" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className={styles.backupLoginHint}>
        UCSD deletes @ucsd.edu Google accounts some time after graduation — link a second Google account (like a personal Gmail) now so you can still get back into this account
        (tickets, activity history, everything) after that happens. This is especially worth doing once you know you&apos;re graduating soon.
      </p>

      {error && <Notice tone="error">{error}</Notice>}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <Button onClick={() => handleLink('google')} loading={linking}>
          {linking ? 'Redirecting…' : identities?.some((i) => i.provider === 'google') ? 'Link Another Google Account' : 'Link Your Google Account'}
        </Button>
        {!identities?.some((i) => i.provider === 'discord') && (
          <Button variant="secondary" onClick={() => handleLink('discord')} disabled={linking}>
            Connect Discord
          </Button>
        )}
      </div>
    </div>
  );
}
