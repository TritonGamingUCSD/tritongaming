import { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getProfile, getUserRoles } from '@/lib/auth';
import { hasCapability, isVerifiedMember } from '@/lib/capabilities';
import { resolveAvatarUrl } from '@/lib/profile';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import PortalHub, { type HubSection } from '@/components/portal/PortalHub';
import SignOutButton from '@/components/portal/SignOutButton';
import DashboardClient from './DashboardClient';
import TicketsClient from './tickets/TicketsClient';
import { getTicketsData } from './tickets/getTicketsData';
import ProfileClient from './profile/ProfileClient';
import CheckInClient from './checkin/CheckInClient';
import { getCheckinData } from './checkin/getCheckinData';
import EventsSectionContent from './events/EventsSectionContent';
import { getEventsData } from './events/getEventsData';
import MembersSectionContent from './members/MembersSectionContent';
import { getMembersData } from './members/getMembersData';
import DivisionsManager from './divisions/DivisionsManager';
import { getDivisionsData } from './divisions/getDivisionsData';
import QRStudioClient from './qrcode/QRStudioClient';
import ContentEditor from './admin/content/ContentEditor';
import { getContentData } from './admin/content/getContentData';
import AdminSectionContent from './admin/AdminSectionContent';
import { getAdminData } from './admin/getAdminData';
import DocsClient from './docs/DocsClient';
import { getDocsData } from './docs/getDocsData';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalDashboard() {
  const [profile, roles] = await Promise.all([getProfile(), getUserRoles()]);
  if (!profile) return null;

  const canManageEvents = hasCapability(roles, 'manage_events');
  const canCheckin = hasCapability(roles, 'checkin');
  const canViewMembers = hasCapability(roles, 'view_members');
  const canManageDivisions = hasCapability(roles, 'manage_divisions_directory');
  const canGenerateQr = hasCapability(roles, 'generate_qr_codes');
  const canEditContent = hasCapability(roles, 'manage_site_content');
  const canViewAdmin = hasCapability(roles, 'view_admin_dashboard');
  const canManageDocs = hasCapability(roles, 'manage_docs');

  // Every section a user can reach is fetched here, in parallel, capability
  // by capability — a plain member only ever triggers the tickets query. The
  // hub then just renders whichever of these were fetched; nothing is
  // re-fetched client-side when a card opens.
  const [ticketsData, checkinData, eventsData, membersData, divisionsData, contentData, adminData, docsData] =
    await Promise.all([
      getTicketsData(profile.id, roles),
      canCheckin ? getCheckinData() : Promise.resolve(null),
      canManageEvents ? getEventsData() : Promise.resolve(null),
      canViewMembers ? getMembersData() : Promise.resolve(null),
      canManageDivisions ? getDivisionsData() : Promise.resolve(null),
      canEditContent ? getContentData() : Promise.resolve(null),
      canViewAdmin ? getAdminData(roles) : Promise.resolve(null),
      canManageDocs ? getDocsData() : Promise.resolve(null),
    ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const nowDate = new Date();
  const nextTicket = ticketsData.tickets
    .filter((t) => t.status === 'active' && t.event && new Date(t.event.start_date) >= nowDate)
    .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())[0];
  const activeTicketCount = ticketsData.tickets.filter((t) => t.status === 'active').length;

  // Events starting within the next/last 24h, for the check-in shortcut
  // banner — derived from checkinData (already scoped to "recent or soon")
  // instead of a second query.
  const todayEvents = (checkinData?.events ?? []).filter(
    (e) => new Date(e.start_date).getTime() <= Date.now() + 24 * 3600_000
  );

  const sections: HubSection[] = [
    {
      id: 'tickets', icon: '🎟️', label: 'My Tickets',
      description: 'View and show your event tickets',
      badge: activeTicketCount || undefined,
      content: <TicketsClient tickets={ticketsData.tickets} upcomingEvents={ticketsData.upcomingEvents} isUcsd={ticketsData.isUcsd} />,
    },
    {
      id: 'profile', icon: '👤', label: 'Profile',
      description: 'Update your info and preferences',
      content: <ProfileClient profile={profile} roles={roles} isUcsd={isVerifiedMember(roles)} />,
    },
    ...(canCheckin && checkinData ? [{
      id: 'checkin', icon: '📷', label: 'Check-In Scanner',
      description: 'Scan tickets to check people in',
      content: <CheckInClient events={checkinData.events} />,
    }] : []),
    ...(canManageEvents && eventsData ? [{
      id: 'events', icon: '🗓️', label: 'Events',
      description: 'Create and manage events',
      content: <EventsSectionContent events={eventsData.events} />,
    }] : []),
    ...(canViewMembers && membersData ? [{
      id: 'members', icon: '👥', label: 'Members',
      description: 'Browse everyone in the org',
      badge: membersData.rows.length || undefined,
      content: <MembersSectionContent rows={membersData.rows} roles={roles} />,
    }] : []),
    ...(canManageDivisions && divisionsData ? [{
      id: 'divisions', icon: '🎮', label: 'Divisions',
      description: 'Manage the division directory',
      content: <DivisionsManager divisions={divisionsData.divisions} />,
    }] : []),
    ...(canGenerateQr ? [{
      id: 'qrcode', icon: '🔳', label: 'QR Studio',
      description: 'Design branded QR codes',
      content: <QRStudioClient />,
    }] : []),
    ...(canEditContent && contentData ? [{
      id: 'content', icon: '✏️', label: 'Edit Site Content',
      description: 'Banners, stats, and text on the public site',
      content: <ContentEditor blocks={CONTENT_BLOCKS} contentMap={contentData.contentMap} lastEdited={contentData.lastEdited} />,
    }] : []),
    ...(canViewAdmin && adminData ? [{
      id: 'admin', icon: '🛡️', label: 'Admin',
      description: 'Platform stats and role management',
      content: <AdminSectionContent {...adminData} />,
    }] : []),
    ...(canManageDocs && docsData ? [{
      id: 'docs', icon: '📚', label: 'Documentation',
      description: 'How-to guides for officers, leads, and execs',
      badge: docsData.docs.length || undefined,
      content: <DocsClient initialDocs={docsData.docs} userId={profile.id} />,
    }] : []),
  ];

  const avatarUrl = resolveAvatarUrl(profile);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={profile.display_name || 'User'}
              width={48}
              height={48}
              className={styles.headerAvatar}
              unoptimized
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={styles.headerAvatarFallback}>
              {(profile.display_name || 'U')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className={styles.greeting}>{greeting}, {profile.display_name?.split(' ')[0] || 'Triton'}</p>
            <div className={styles.roleChips}>
              {roles.length === 0 ? (
                <span className={styles.roleChip} style={{ background: ROLE_COLORS.guest + '18', color: ROLE_COLORS.guest, borderColor: ROLE_COLORS.guest + '44' }}>
                  {ROLE_LABELS.guest}
                </span>
              ) : (
                roles.map((r) => (
                  <span
                    key={r.role}
                    className={styles.roleChip}
                    style={{ background: ROLE_COLORS[r.role] + '18', color: ROLE_COLORS[r.role], borderColor: ROLE_COLORS[r.role] + '44' }}
                  >
                    {ROLE_LABELS[r.role]}
                  </span>
                ))
              )}
            </div>
            <div className={styles.headerActions}>
              <Link href="/" className={styles.headerActionLink}>Back to Site</Link>
              <span className={styles.headerActionDivider} aria-hidden="true">·</span>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {canCheckin && todayEvents.length > 0 && (
        <Link href="/portal?open=checkin" className={styles.checkinBanner}>
          <div className={styles.checkinBannerDot} />
          <div>
            <div className={styles.checkinBannerTitle}>Event today — {todayEvents[0].title}</div>
            <div className={styles.checkinBannerSub}>Tap to open check-in scanner</div>
          </div>
          <span className={styles.checkinBannerIcon}>📷</span>
        </Link>
      )}

      {nextTicket && !canManageEvents && (
        <DashboardClient ticket={nextTicket as Parameters<typeof DashboardClient>[0]['ticket']} />
      )}

      <Suspense>
        <PortalHub sections={sections} />
      </Suspense>
    </div>
  );
}
