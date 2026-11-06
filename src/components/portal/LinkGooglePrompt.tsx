'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Dialog, { DialogActions } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';

const SNOOZE_KEY = 'tg-link-google-snooze';

// Someone who signed in with Discord has no Google account on their profile, so they have no UCSD verification and none of the member roles that come with it.
// This asks them (once per browser session until they link) to link their Google account. Linking keeps one profile with both ways in.
export default function LinkGooglePrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SNOOZE_KEY)) return;
    } catch {
      /* storage blocked: ask anyway */
    }
    void (async () => {
      const { data } = await createClient().auth.getUserIdentities();
      const ids = data?.identities ?? [];
      if (ids.some((i) => i.provider === 'discord') && !ids.some((i) => i.provider === 'google')) setOpen(true);
    })();
  }, []);

  const later = () => {
    try {
      sessionStorage.setItem(SNOOZE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const link = async () => {
    setBusy(true);
    setError('');
    const { error: err } = await createClient().auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/portal')}`, queryParams: { prompt: 'select_account' } },
    });
    if (err) {
      setError(err.message || 'Could not start linking. Try again.');
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <Dialog title="Link your Google account" onClose={later} busy={busy}>
      <p>
        You signed in with Discord. To get your member roles, link the Google account you use at UCSD (your @ucsd.edu address). It joins this same profile, so nothing is lost and
        you can use either to sign in.
      </p>
      <p>Without it you stay a guest: you can still join public events, but UCSD-only features stay locked.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <DialogActions>
        <Button variant="secondary" onClick={later} disabled={busy}>
          Not Now
        </Button>
        <Button onClick={link} loading={busy}>
          Link Google
        </Button>
      </DialogActions>
    </Dialog>
  );
}
