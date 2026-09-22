'use client';

import { useEffect, useState } from 'react';
import type { UserIdentity } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './profile.module.css';

// Sign-in here is Google OAuth only (see login/page.tsx) — for most members
// that's fine indefinitely, but UC San Diego deletes @ucsd.edu Google
// accounts some time after graduation, which would otherwise permanently
// lock an alumnus out of their own account (their profile, past tickets,
// activity history — all of it, since it's all keyed to that same auth
// user id). supabase.auth.linkIdentity attaches a *second* Google account
// (e.g. a personal Gmail) to the same account without disturbing the
// existing one — Supabase matches by the Google identity itself at sign-in,
// not by which button was clicked, so "Continue with Google" on the login
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
  const [userId, setUserId] = useState<string | null>(null);
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [savingPreferred, setSavingPreferred] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadIdentities() {
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.getUserIdentities();
    if (!err && data) setIdentities(data.identities);
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [, { data: profileData }] = await Promise.all([
        loadIdentities(),
        supabase.from('profiles').select('preferred_email').eq('id', user.id).single(),
      ]);
      setPreferred(profileData?.preferred_email ?? null);
    })();
  }, []);

  function emailOf(identity: UserIdentity): string {
    return (identity.identity_data?.email as string | undefined) ?? '';
  }

  async function handleSetPreferred(email: string | null) {
    if (!userId) return;
    setPreferred(email);
    setSavingPreferred(true);
    const supabase = createClient();
    await supabase.from('profiles').update({ preferred_email: email }).eq('id', userId);
    setSavingPreferred(false);
  }

  async function handleLink() {
    setError('');
    setLinking(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/portal?section=profile&tab=security')}` },
    });
    // On success this navigates away to Google's consent screen — setLinking(false)
    // only actually runs if it failed before that redirect happened.
    if (err) {
      setError(err.message || 'Failed to start linking. Please try again.');
      setLinking(false);
    }
  }

  async function handleUnlink(identity: UserIdentity) {
    const email = emailOf(identity);
    if (!window.confirm(`Unlink ${email}? You'll no longer be able to sign in with that Google account.`)) return;
    setError('');
    setUnlinkingId(identity.identity_id);
    const supabase = createClient();
    const { error: err } = await supabase.auth.unlinkIdentity(identity);
    setUnlinkingId(null);
    if (err) {
      setError(err.message || 'Failed to unlink. Please try again.');
      return;
    }
    if (preferred === email) await handleSetPreferred(null);
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
              {canUnlink && (
                <button
                  type="button"
                  className={styles.unlinkBtn}
                  onClick={() => handleUnlink(i)}
                  disabled={unlinkingId === i.identity_id}
                  aria-label={`Unlink ${emailOf(i)}`}
                >
                  {unlinkingId === i.identity_id ? '…' : <X size={13} strokeWidth={1.75} aria-hidden="true" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {identities && identities.length > 1 && (
        <div className={styles.preferredEmailBlock}>
          <span className={styles.preferredEmailLabel}>
            Which email should staff see (Members, Role Manager) instead of all of them?
          </span>
          <label className={styles.checkboxField}>
            <input type="radio" name="preferredEmail" checked={preferred === null} onChange={() => handleSetPreferred(null)} disabled={savingPreferred} />
            <span>Show all linked emails</span>
          </label>
          {identities.map((i) => (
            <label key={`pref-${i.identity_id}`} className={styles.checkboxField}>
              <input type="radio" name="preferredEmail" checked={preferred === emailOf(i)} onChange={() => handleSetPreferred(emailOf(i))} disabled={savingPreferred} />
              <span>Only show {emailOf(i)}</span>
            </label>
          ))}
        </div>
      )}

      <p className={styles.backupLoginHint}>
        UCSD deletes @ucsd.edu Google accounts some time after graduation — link a second Google
        account (like a personal Gmail) now so you can still get back into this account (tickets,
        activity history, everything) after that happens. This is especially worth doing once you
        know you&apos;re graduating soon.
      </p>

      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.saveBtn} onClick={handleLink} disabled={linking}>
        {linking ? 'Redirecting…' : 'Link Another Google Account'}
      </button>
    </div>
  );
}
