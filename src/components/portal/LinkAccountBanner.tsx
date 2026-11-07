'use client';

import { useEffect, useState } from 'react';
import Link from '@/components/portal/NoPrefetchLink';
import { usePathname } from 'next/navigation';
import { Link2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './ProfileIncompleteBanner.module.css';

const SNOOZE_KEY = 'tg-link-account-snooze'; // localStorage: when the ask was last dismissed
const EVERY_DAYS = 7;

// A slim banner like the "finish your profile" one (never a popup). Signed in with Discord and no Google linked -> ask for Google (that is where the UCSD roles come from).
// Signed in with Google and no Discord -> ask for Discord. Both link from Profile → Security. Dismissing it hides it for a week.
export default function LinkAccountBanner() {
  const pathname = usePathname();
  const [ask, setAsk] = useState<'google' | 'discord' | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const last = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        if (Date.now() - last < EVERY_DAYS * 86400000) return;
      } catch {
        /* storage blocked: ask anyway */
      }
      const { data } = await createClient().auth.getUserIdentities();
      const ids = data?.identities ?? [];
      const hasDiscord = ids.some((i) => i.provider === 'discord');
      const hasGoogle = ids.some((i) => i.provider === 'google');
      if (hasDiscord && !hasGoogle) setAsk('google');
      else if (hasGoogle && !hasDiscord) setAsk('discord');
    })();
  }, []);

  if (!ask || pathname.startsWith('/portal/profile')) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setAsk(null);
  };

  return (
    <div className={styles.banner} role="status" data-top-banner>
      <Link2 size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
      <p className={styles.text}>
        {ask === 'google' ? (
          <>
            <strong>Link your Google account.</strong>
            <span className={styles.need}> It joins this profile and gives you your UCSD member roles.</span>
          </>
        ) : (
          <>
            <strong>Connect your Discord.</strong>
            <span className={styles.need}> One click, and you can disconnect it any time.</span>
          </>
        )}
      </p>
      <Link href="/portal/profile/security" className={styles.btn}>
        {ask === 'google' ? 'Link Google' : 'Connect Discord'}
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide for a week"
        style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 4, display: 'flex' }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
