'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Dialog, { DialogActions } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';

const SNOOZE_KEY = 'tg-link-google-snooze';
const DISCORD_KEY = 'tg-link-discord-snooze'; // localStorage: when the Discord ask was last dismissed
const DISCORD_EVERY_DAYS = 14;

// Someone who signed in with Discord has no Google account on their profile, so they have no UCSD verification and none of the member roles that come with it.
// This asks them (once per browser session until they link) to link their Google account. Linking keeps one profile with both ways in.
export default function LinkGooglePrompt() {
  const [open, setOpen] = useState<'google' | 'discord' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const { data } = await createClient().auth.getUserIdentities();
      const ids = data?.identities ?? [];
      const hasDiscord = ids.some((i) => i.provider === 'discord');
      const hasGoogle = ids.some((i) => i.provider === 'google');
      try {
        if (hasDiscord && !hasGoogle) {
          if (!sessionStorage.getItem(SNOOZE_KEY)) setOpen('google');
        } else if (hasGoogle && !hasDiscord) {
          const last = Number(localStorage.getItem(DISCORD_KEY) || 0);
          if (Date.now() - last > DISCORD_EVERY_DAYS * 86400000) setOpen('discord');
        }
      } catch {
        if (hasDiscord && !hasGoogle) setOpen('google');
      }
    })();
  }, []);

  const later = () => {
    try {
      if (open === 'discord') localStorage.setItem(DISCORD_KEY, String(Date.now()));
      else sessionStorage.setItem(SNOOZE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(null);
  };

  const link = async () => {
    setBusy(true);
    setError('');
    const { error: err } = await createClient().auth.linkIdentity({
      provider: open === 'discord' ? 'discord' : 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/portal')}`,
        ...(open === 'discord' ? { scopes: 'identify email' } : { queryParams: { prompt: 'select_account' } }),
      },
    });
    if (err) {
      setError(err.message || 'Could not start linking. Try again.');
      setBusy(false);
    }
  };

  if (!open) return null;
  if (open === 'discord')
    return (
      <Dialog title="Connect your Discord" onClose={later} busy={busy}>
        <p>
          Connect Discord to this profile so the club can reach you there and show up in the server as you. It takes one click and you can disconnect it any time in your profile.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <DialogActions>
          <Button variant="secondary" onClick={later} disabled={busy}>
            Not Now
          </Button>
          <Button onClick={link} loading={busy}>
            Connect Discord
          </Button>
        </DialogActions>
      </Dialog>
    );
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
