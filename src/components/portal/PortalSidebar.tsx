'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { hasRole, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import styles from './PortalSidebar.module.css';

interface Props {
  profile: Profile;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole?: Profile['role'];
}

const NAV: NavItem[] = [
  { href: '/portal',         label: 'Dashboard',       icon: '⚡' },
  { href: '/portal/profile', label: 'My Profile',      icon: '👤' },
  { href: '/portal/tickets', label: 'My Tickets',      icon: '🎟️' },
  { href: '/portal/events',  label: 'Events',          icon: '🗓️',  minRole: 'officer' },
  { href: '/portal/checkin', label: 'Check-In Scanner',icon: '📷',  minRole: 'officer' },
  { href: '/portal/division',label: 'My Division',     icon: '🎮',  minRole: 'lead' },
  { href: '/portal/members', label: 'Members',         icon: '👥',  minRole: 'exec' },
  { href: '/portal/admin',   label: 'Admin',           icon: '🛡️',  minRole: 'admin' },
];

export default function PortalSidebar({ profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const visibleNav = NAV.filter(
    (item) => !item.minRole || hasRole(profile.role, item.minRole)
  );

  const sidebarContent = (
    <div className={styles.inner}>
      <div className={styles.brand}>
        <Image src="/logos/tg_logo_multi.png" alt="TG" width={40} height={40} />
        <div>
          <div className={styles.brandName}>Triton Gaming</div>
          <div className={styles.brandSub}>Member Portal</div>
        </div>
      </div>

      <div className={styles.userCard}>
        {profile.avatar_url ? (
          <Image
            src={profile.avatar_url}
            alt={profile.display_name || 'User'}
            width={44}
            height={44}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {(profile.display_name || 'U')[0].toUpperCase()}
          </div>
        )}
        <div className={styles.userInfo}>
          <div className={styles.userName}>{profile.display_name || 'Member'}</div>
          <span
            className={styles.roleTag}
            style={{ background: ROLE_COLORS[profile.role] + '22', color: ROLE_COLORS[profile.role] }}
          >
            {ROLE_LABELS[profile.role]}
          </span>
        </div>
      </div>

      <nav className={styles.nav} aria-label="Portal navigation">
        {visibleNav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/portal' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.navActive : ''}`}
            >
              <span className={styles.navIcon} aria-hidden="true">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <button className={styles.signOutBtn} onClick={handleSignOut}>
        <span aria-hidden="true">↩</span> Sign Out
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar} aria-label="Portal sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile hamburger */}
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle sidebar"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className={styles.mobileOverlay}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className={styles.mobileSidebar}>{sidebarContent}</aside>
        </>
      )}
    </>
  );
}
