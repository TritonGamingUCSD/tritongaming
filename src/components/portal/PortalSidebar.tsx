'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, UserRole } from '@/types/database';
import { hasRole, ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import styles from './PortalSidebar.module.css';

interface Props {
  profile: Profile;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  dividerBefore?: boolean;
}

const NAV: NavItem[] = [
  { href: '/portal',               label: 'Dashboard',        icon: '⚡' },
  { href: '/portal/profile',       label: 'My Profile',       icon: '👤' },
  { href: '/portal/tickets',       label: 'My Tickets',       icon: '🎟️' },
  { dividerBefore: true,
    href: '/portal/division',      label: 'My Division',      icon: '🎮',  minRole: 'lead' },
  { href: '/portal/checkin',       label: 'Check-In Scanner', icon: '📷',  minRole: 'lead' },
  { href: '/portal/events',        label: 'Events',           icon: '🗓️',  minRole: 'officer' },
  { href: '/portal/members',       label: 'Members',          icon: '👥',  minRole: 'officer' },
  { dividerBefore: true,
    href: '/portal/admin/content', label: 'Edit Site Content',icon: '✏️',  allowedRoles: ['lead','exec','admin'] },
  { href: '/portal/admin',         label: 'Admin',            icon: '🛡️',  minRole: 'exec' },
];

function getBottomTabs(role: UserRole) {
  if (hasRole(role, 'exec')) return [
    { href: '/portal',          icon: '⚡', label: 'Home' },
    { href: '/portal/events',   icon: '🗓️', label: 'Events' },
    { href: '/portal/admin',    icon: '🛡️', label: 'Admin' },
    { href: '/portal/members',  icon: '👥', label: 'Members' },
    { href: '/portal/profile',  icon: '👤', label: 'Profile' },
  ];
  if (hasRole(role, 'lead')) return [
    { href: '/portal',          icon: '⚡', label: 'Home' },
    { href: '/portal/division', icon: '🎮', label: 'Division' },
    { href: '/portal/checkin',  icon: '📷', label: 'Check-In' },
    { href: '/portal/members',  icon: '👥', label: 'Members' },
    { href: '/portal/profile',  icon: '👤', label: 'Profile' },
  ];
  if (hasRole(role, 'officer')) return [
    { href: '/portal',          icon: '⚡', label: 'Home' },
    { href: '/portal/events',   icon: '🗓️', label: 'Events' },
    { href: '/portal/checkin',  icon: '📷', label: 'Check-In' },
    { href: '/portal/members',  icon: '👥', label: 'Members' },
    { href: '/portal/profile',  icon: '👤', label: 'Profile' },
  ];
  return [
    { href: '/portal',         icon: '⚡', label: 'Home' },
    { href: '/portal/tickets', icon: '🎟️', label: 'Tickets' },
    { href: '/board',          icon: '💬', label: 'Board' },
    { href: '/portal/profile', icon: '👤', label: 'Profile' },
  ];
}

export default function PortalSidebar({ profile }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const visibleNav = NAV.filter((item) => {
    if (item.allowedRoles) return item.allowedRoles.includes(profile.role);
    if (item.minRole) return hasRole(profile.role, item.minRole);
    return true;
  });

  const bottomTabs = getBottomTabs(profile.role);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={styles.sidebar} aria-label="Portal sidebar">
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
            {visibleNav.map((item) => {
              const active = pathname === item.href || (item.href !== '/portal' && pathname.startsWith(item.href));
              return (
                <span key={item.href}>
                  {item.dividerBefore && <div className={styles.navDivider} />}
                  <Link
                    href={item.href}
                    className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                  >
                    <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                    {item.label}
                  </Link>
                </span>
              );
            })}
          </nav>

          <button className={styles.signOutBtn} onClick={handleSignOut}>
            <span aria-hidden="true">↩</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile: iOS-style bottom tab bar */}
      <nav className={styles.bottomNav} aria-label="Portal navigation">
        {bottomTabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/portal' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.bottomTab} ${active ? styles.bottomTabActive : ''}`}
            >
              <span className={styles.bottomTabIcon}>{tab.icon}</span>
              <span className={styles.bottomTabLabel}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
