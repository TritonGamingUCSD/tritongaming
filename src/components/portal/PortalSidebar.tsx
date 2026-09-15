'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Capability } from '@/types/database';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import { hasCapability, type RoleGrant } from '@/lib/capabilities';
import styles from './PortalSidebar.module.css';

interface Props {
  profile: Profile;
  roles: RoleGrant[];
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  capability?: Capability;
  dividerBefore?: boolean;
}

const NAV: NavItem[] = [
  { href: '/portal',               label: 'Dashboard',        icon: '⚡' },
  { href: '/portal/profile',       label: 'My Profile',       icon: '👤' },
  { href: '/portal/tickets',       label: 'My Tickets',       icon: '🎟️' },
  { dividerBefore: true,
    href: '/portal/checkin',       label: 'Check-In Scanner', icon: '📷', capability: 'checkin' },
  { href: '/portal/events',        label: 'Events',           icon: '🗓️', capability: 'manage_events' },
  { href: '/portal/members',       label: 'Members',          icon: '👥', capability: 'view_members' },
  { dividerBefore: true,
    href: '/portal/admin/content', label: 'Edit Site Content', icon: '✏️', capability: 'manage_site_content' },
  { href: '/portal/admin',         label: 'Admin',            icon: '🛡️', capability: 'view_admin_dashboard' },
];

// Role-specific bottom tab bars — iOS-style
function getBottomTabs(roles: RoleGrant[]) {
  if (hasCapability(roles, 'view_admin_dashboard')) return [
    { href: '/portal',         icon: HomeIcon,    label: 'Home' },
    { href: '/portal/events',  icon: CalendarIcon, label: 'Events' },
    { href: '/portal/checkin', icon: ScanIcon,    label: 'Scan' },
    { href: '/portal/members', icon: PeopleIcon,  label: 'Members' },
    { href: '/portal/admin',   icon: ShieldIcon,  label: 'Admin' },
  ];
  if (hasCapability(roles, 'manage_events')) return [
    { href: '/portal',         icon: HomeIcon,    label: 'Home' },
    { href: '/portal/checkin', icon: ScanIcon,    label: 'Scan' },
    { href: '/portal/events',  icon: CalendarIcon, label: 'Events' },
    { href: '/portal/members', icon: PeopleIcon,  label: 'Members' },
    { href: '/portal/profile', icon: PersonIcon,  label: 'Me' },
  ];
  if (hasCapability(roles, 'checkin') || hasCapability(roles, 'manage_division')) return [
    { href: '/portal',          icon: HomeIcon,    label: 'Home' },
    { href: '/portal/checkin',  icon: ScanIcon,    label: 'Scan' },
    { href: '/events',          icon: CalendarIcon, label: 'Events' },
    { href: '/portal/tickets',  icon: TicketIcon,  label: 'Tickets' },
    { href: '/portal/profile',  icon: PersonIcon,  label: 'Me' },
  ];
  // guest / ucsd with no staff capabilities
  return [
    { href: '/portal',         icon: HomeIcon,   label: 'Home' },
    { href: '/portal/tickets', icon: TicketIcon, label: 'Tickets' },
    { href: '/events',         icon: CalendarIcon, label: 'Events' },
    { href: '/portal/profile', icon: PersonIcon, label: 'Me' },
  ];
}

export default function PortalSidebar({ profile, roles }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  const visibleNav = NAV.filter((item) => !item.capability || hasCapability(roles, item.capability));

  const bottomTabs = getBottomTabs(roles);

  function isActive(href: string) {
    if (href === '/portal') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────── */}
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
              <div className={styles.roleTagRow}>
                {roles.length === 0 ? (
                  <span className={styles.roleTag} style={{ background: ROLE_COLORS.guest + '22', color: ROLE_COLORS.guest }}>
                    {ROLE_LABELS.guest}
                  </span>
                ) : (
                  roles.map((r) => (
                    <span key={r.role} className={styles.roleTag} style={{ background: ROLE_COLORS[r.role] + '22', color: ROLE_COLORS[r.role] }}>
                      {ROLE_LABELS[r.role]}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <nav className={styles.nav} aria-label="Portal navigation">
            {visibleNav.map((item) => {
              const active = isActive(item.href);
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

      {/* ── Mobile: iOS-style bottom tab bar ──────── */}
      <nav className={styles.bottomNav} aria-label="Portal navigation">
        {bottomTabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.bottomTab} ${active ? styles.bottomTabActive : ''}`}
            >
              <span className={styles.bottomTabIconWrap}>
                <Icon active={active} />
              </span>
              <span className={styles.bottomTabLabel}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// SVG tab icons (iOS-style filled/outline variants)
function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
    </svg>
  );
}

function TicketIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M20 12c0-1.1.9-2 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v3a2 2 0 000 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 000-4V7a2 2 0 00-2-2H5a2 2 0 00-2 2z"/>
      <line x1="9" y1="9" x2="9" y2="15"/>
      <line x1="15" y1="9" x2="15" y2="15"/>
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function ScanIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M3 5h2V3H1v4h2V5zm0 8H1v4h4v-2H3v-2zm16 2h-2v2h4v-4h-2v2zM19 3v2h2v2h2V3h-4zm-7 13H9v-2H7v4h6v-2zm4-8h-2v2h2v-2zm2 0h2V6h-4v2h2v2zM7 8H5v2h2V8zm4-4H9v2h2V4zm-2 4H7v2h2V8z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 7 4"/>
      <polyline points="20 7 20 4 17 4"/>
      <polyline points="4 17 4 20 7 20"/>
      <polyline points="20 17 20 20 17 20"/>
      <rect x="9" y="9" width="6" height="6"/>
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.65-10 5v2h20v-2c0-3.35-6.7-5-10-5z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function ShieldIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
