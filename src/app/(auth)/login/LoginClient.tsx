'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

function GoogleIcon() {
  return (
    <svg
      className={styles.googleIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Two ways in. The main button is for UCSD accounts: Google then lists only @ucsd.edu accounts, so nobody lands on a personal Gmail by accident. The smaller
// one is for guests at public events, who sign in with any Google account.
export default function LoginClient({ next }: { next?: string }) {
  const [loading, setLoading] = useState<'ucsd' | 'guest' | null>(null);

  async function handleGoogleSignIn(ucsd: boolean) {
    setLoading(ucsd ? 'ucsd' : 'guest');
    const supabase = createClient();
    const origin = window.location.origin;
    // `next` rides along in this URL because it is the one thing that survives the round trip out to Google and back (auth/callback/route.ts reads it).
    const callbackParams = new URLSearchParams();
    if (next) callbackParams.set('next', next);
    const query = callbackParams.toString();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback${query ? `?${query}` : ''}`,
        // Always show Google's account chooser: many phones have a personal Gmail as the default, and one tap on it signs in without a UCSD role.
        // `hd` is only a hint to Google; the role itself is still granted by the @ucsd.edu check on our side.
        queryParams: { prompt: 'select_account', ...(ucsd ? { hd: 'ucsd.edu' } : {}) },
      },
    });
  }

  return (
    <>
    <p className={styles.who}><strong>UCSD students</strong> and members</p>
    <button
      className={styles.googleBtn}
      onClick={() => handleGoogleSignIn(true)}
      disabled={loading !== null}
    >
      {loading === 'ucsd' ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <GoogleIcon />
      )}
      {loading === 'ucsd' ? 'Redirecting…' : 'Sign in with @ucsd.edu'}
    </button>
    <p className={`${styles.who} ${styles.whoGuest}`}><strong>Guests</strong> at public events</p>
    <button className={styles.guestBtn} onClick={() => handleGoogleSignIn(false)} disabled={loading !== null}>
      {loading === 'guest' ? <span className={`${styles.spinner} ${styles.spinnerDark}`} aria-hidden="true" /> : <GoogleIcon />}
      {loading === 'guest' ? 'Redirecting…' : 'Sign in with Google'}
    </button>
    </>
  );
}
