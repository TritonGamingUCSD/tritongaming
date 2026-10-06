'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserRoundPen } from 'lucide-react';
import styles from './ProfileIncompleteBanner.module.css';

// Shown across the whole portal (see the portal layout) whenever the signed-in
// person's required profile info is still blank — they get nudged wherever
// they land, not only when a ticket claim bounces them to the profile page.
// Hidden on the profile page itself, which already says what's missing, and
// links there with ?next= so saving drops them back where they were.
export default function ProfileIncompleteBanner({ missing, officerTabOnly = false }: { missing: string[]; officerTabOnly?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (missing.length === 0) return null;
  if (pathname.startsWith('/portal/profile') || searchParams.get('section') === 'profile') return null;

  const here = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
  // Only the officer title missing -> open the Officer Card tab directly.
  const href = officerTabOnly
    ? `/portal/profile/card?next=${encodeURIComponent(here)}`
    : `/portal/profile?next=${encodeURIComponent(here)}`;

  return (
    <div className={styles.banner} role="status">
      <UserRoundPen size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
      <p className={styles.text}>
        <strong>Finish your profile.</strong> Still needed: {missing.join(', ')}.
      </p>
      <Link href={href} className={styles.btn}>Update profile</Link>
    </div>
  );
}
