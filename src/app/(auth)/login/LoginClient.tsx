'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

function GoogleIcon() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"
      />
    </svg>
  );
}

// Two ways in. The main button is for UCSD accounts: Google then lists only @ucsd.edu accounts, so nobody lands on a personal Gmail by accident. The smaller
// one is for guests at public events, who sign in with any Google account.
export default function LoginClient({ next }: { next?: string }) {
  const [loading, setLoading] = useState<'ucsd' | 'guest' | 'discord' | null>(null);
  const [down, setDown] = useState(false);

  async function handleSignIn(provider: 'google' | 'discord', ucsd: boolean) {
    setLoading(provider === 'discord' ? 'discord' : ucsd ? 'ucsd' : 'guest');
    setDown(false);
    // Google sign-in hands the browser over to Supabase; when Supabase is not answering that would sit on "Redirecting" for good, so check first (an opaque answer is enough, only silence matters).
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    } catch {
      setLoading(null);
      setDown(true);
      return;
    }
    const supabase = createClient();
    const origin = window.location.origin;
    // `next` rides along in this URL because it is the one thing that survives the round trip out to Google and back (auth/callback/route.ts reads it).
    const callbackParams = new URLSearchParams();
    if (next) callbackParams.set('next', next);
    const query = callbackParams.toString();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${origin}/auth/callback${query ? `?${query}` : ''}`,
        ...(provider === 'discord' ? { scopes: 'identify email' } : {}),
        // Always show Google's account chooser: many phones have a personal Gmail as the default, and one tap on it signs in without a UCSD role.
        // `hd` is only a hint to Google; the role itself is still granted by the @ucsd.edu check on our side.
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account', ...(ucsd ? { hd: 'ucsd.edu' } : {}) } } : {}),
      },
    });
  }

  return (
    <>
      <p className={styles.who}>
        <strong>UCSD students</strong> and members
      </p>
      <button className={styles.googleBtn} onClick={() => handleSignIn('google', true)} disabled={loading !== null}>
        {loading === 'ucsd' ? <span className={styles.spinner} aria-hidden="true" /> : <GoogleIcon />}
        {loading === 'ucsd' ? 'Redirecting…' : 'Sign in with @ucsd.edu'}
      </button>
      <div className={styles.or} role="separator">
        <span>or</span>
      </div>
      <p className={styles.who}>
        <strong>Guests</strong> at public events, or another way in
      </p>
      <div className={styles.altRow}>
        <button className={styles.guestBtn} onClick={() => handleSignIn('google', false)} disabled={loading !== null}>
          {loading === 'guest' ? <span className={`${styles.spinner} ${styles.spinnerDark}`} aria-hidden="true" /> : <GoogleIcon />}
          {loading === 'guest' ? 'Redirecting…' : 'Google'}
        </button>
        <button className={styles.guestBtn} onClick={() => handleSignIn('discord', false)} disabled={loading !== null}>
          {loading === 'discord' ? <span className={`${styles.spinner} ${styles.spinnerDark}`} aria-hidden="true" /> : <DiscordIcon />}
          {loading === 'discord' ? 'Redirecting…' : 'Discord'}
        </button>
      </div>
      <p className={styles.tip}>
        <strong>Used Discord?</strong> You can link your @ucsd.edu Google account afterward to get your member roles.
      </p>
      {down && (
        <p className={styles.who} role="alert">
          Can&apos;t reach the sign-in service right now. Please try again in a minute.
        </p>
      )}
    </>
  );
}
