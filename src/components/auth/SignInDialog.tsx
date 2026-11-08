'use client';

import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

// Sign in without leaving the page: Google (any account), @ucsd.edu for students, or Discord. After signing in the person comes back to `next` (the page they were on) and can finish what they started.
export default function SignInDialog({ next, reason, onClose }: { next: string; reason?: string; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function go(provider: 'google' | 'discord', ucsd: boolean, key: string) {
    setBusy(key);
    setErr('');
    try {
      // When Supabase is not answering, say so instead of sitting on "Redirecting" for good (same check as the sign-in page).
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    } catch {
      setBusy(null);
      setErr('Sign-in is not answering right now. Please try again in a moment.');
      return;
    }
    await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        ...(provider === 'discord' ? { scopes: 'identify email' } : {}),
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account', ...(ucsd ? { hd: 'ucsd.edu' } : {}) } } : {}),
      },
    });
  }

  return (
    <Dialog title="Sign In" onClose={onClose} busy={!!busy}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <p style={{ margin: 0 }}>{reason ?? 'Sign in to continue.'}</p>
        <Button onClick={() => go('google', false, 'google')} loading={busy === 'google'}>
          Continue With Google
        </Button>
        <Button variant="secondary" onClick={() => go('google', true, 'ucsd')} loading={busy === 'ucsd'}>
          UCSD Student? Use Your @ucsd.edu
        </Button>
        <Button variant="secondary" onClick={() => go('discord', false, 'discord')} loading={busy === 'discord'}>
          Continue With Discord
        </Button>
        <p style={{ margin: 0, fontSize: '0.8rem' }}>UCSD students: signing in with your @ucsd.edu account gives you student perks like rewards points.</p>
        {err && (
          <p role="alert" style={{ margin: 0, color: 'var(--pp-bad)' }}>
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
