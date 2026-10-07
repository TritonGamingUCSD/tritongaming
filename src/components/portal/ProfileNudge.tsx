'use client';

import IconButton from '@/components/ui/IconButton';
import { useEffect, useState } from 'react';
import Link from '@/components/portal/NoPrefetchLink';
import { Sparkles } from 'lucide-react';
import type { ProfileNudge as Nudge } from '@/lib/members/profileCompleteness';
import styles from './ProfileNudge.module.css';

const KEY = 'tg_profile_nudge_hidden_until';

// A small, dismissible "your profile is X% done" card with the next couple of things to add. Hidden for a week once closed.
export default function ProfileNudge({ nudge }: { nudge: Nudge }) {
  const [hidden, setHidden] = useState(true);   // start hidden: no flash for people who dismissed it
  useEffect(() => {
    try { setHidden(Number(localStorage.getItem(KEY) ?? 0) > Date.now()); } catch { setHidden(false); }
  }, []);
  if (hidden || nudge.missing.length === 0) return null;
  const next = nudge.missing.slice(0, 3);
  return (
    <section className={styles.card} aria-label="Finish your profile">
      <span className={styles.icon} aria-hidden="true"><Sparkles size={18} strokeWidth={1.75} /></span>
      <div className={styles.body}>
        <div className={styles.top}>
          <strong>Your profile is {nudge.percent}% filled in</strong>
          <span className={styles.bar} role="progressbar" aria-valuenow={nudge.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(6, nudge.percent)}%` }} /></span>
        </div>
        <div className={styles.links}>
          {next.map((m) => <Link key={m.key} href={m.href} className={styles.link}>{m.label}</Link>)}
        </div>
      </div>
      <IconButton kind="close" size="sm" label="Hide for a week" onClick={() => { try { localStorage.setItem(KEY, String(Date.now() + 7 * 86400_000)); } catch { /* ignore */ } setHidden(true); }} />
    </section>
  );
}
