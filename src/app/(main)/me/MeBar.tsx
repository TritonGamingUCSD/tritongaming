'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Globe, LayoutDashboard, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import styles from './me.module.css';

// The one slim bar at the top of /me: the logo, a way back to the main site, and who you are (with Portal for staff and Sign Out). The site's own header, announcement and ticker are left out here on purpose.
export default function MeBar({ name, avatar, portal }: { name: string; avatar: string | null; portal: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  async function signOut() {
    await createClient().auth.signOut();
    router.push('/');
    router.refresh();
  }
  return (
    <header className={styles.bar}>
      <Link href="/me/events" className={styles.brand} aria-label="My Triton Gaming">
        <Image src="/logos/tg_logo.png" alt="" width={44} height={44} />
      </Link>
      <div className={styles.barRight}>
        {portal && (
          <Link href="/portal" prefetch={false} className={`${styles.siteLink} ${styles.portalLink}`}>
            <LayoutDashboard size={16} aria-hidden="true" /> <span>Portal</span>
          </Link>
        )}
        <Link href="/" className={styles.siteLink}>
          <Globe size={16} aria-hidden="true" /> <span>Main Site</span>
        </Link>
        <div className={styles.who} ref={ref}>
          <button type="button" className={styles.whoBtn} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={`${name}, account menu`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatar ? <img src={avatar} alt="" width={32} height={32} referrerPolicy="no-referrer" /> : <span>{name[0]?.toUpperCase()}</span>}
          </button>
          {open && (
            <div className={styles.menu} role="menu">
              <p>{name}</p>
              <button role="menuitem" type="button" onClick={signOut}>
                <LogOut size={16} aria-hidden="true" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
