import Link from 'next/link';
import Image from 'next/image';
import { Ticket, User, Camera, Calendar, Users, Gamepad2, QrCode, Pencil, Shield, BookOpen, History, Image as ImageIcon } from 'lucide-react';
import { getProfile, getUserRoles } from '@/lib/auth';
import { hasCapability, isVerifiedMember } from '@/lib/capabilities';
import { resolveAvatarUrl } from '@/lib/profile';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import { PACIFIC_TZ } from '@/lib/timezone';
import { getDivisions } from '@/lib/divisions';
import type { HubSection } from '@/components/portal/PortalHub';
import SignOutButton from '@/components/portal/SignOutButton';
import DashboardClient from './DashboardClient';
import PortalTopSection from './PortalTopSection';
import TicketsClient from './tickets/TicketsClient';
import { getTicketsData } from './tickets/getTicketsData';
import ProfileClient from './profile/ProfileClient';
import CheckInClient from './checkin/CheckInClient';
import { getCheckinData } from './checkin/getCheckinData';
import EventsSectionContent from './events/EventsSectionContent';
import { getEventsData } from './events/getEventsData';
import MembersSectionContent from './members/MembersSectionContent';
import { getMembersData } from './members/getMembersData';
import { getDivisionsData } from './divisions/getDivisionsData';
import { getMyDivisionsData } from './divisions/getMyDivisionsData';
import QRStudioClient from './qrcode/QRStudioClient';
import SiteContentSectionContent from './content/SiteContentSectionContent';
import { getContentData } from './admin/content/getContentData';
import AdminSectionContent from './admin/AdminSectionContent';
import { getAdminData } from './admin/getAdminData';
import { getStatsData } from './admin/stats/getStatsData';
import DocsClient from './docs/DocsClient';
import { getDocsData } from './docs/getDocsData';
import ActivitySectionContent from './activity/ActivitySectionContent';
import { getRoleHistoryData } from './admin/history/getRoleHistoryData';
import PhotoAlbumsSectionContent from './albums/PhotoAlbumsSectionContent';
import { getPhotoAlbumsData } from './albums/getPhotoAlbumsData';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function PortalDashboard() {
  // divisions is fetched unconditionally (cheap, publicly-readable table) —
  // needed to label a division-lead role chip with *which* division below,
  // regardless of whether this user themselves can manage the directory.
  const [profile, roles, divisions] = await Promise.all([getProfile(), getUserRoles(), getDivisions()]);
  if (!profile) return null;
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));

  const canViewEvents = hasCapability(roles, 'view_events');
  const canManageEvents = hasCapability(roles, 'manage_events');
  const canCheckin = hasCapability(roles, 'checkin');
  const canViewMembers = hasCapability(roles, 'view_members');
  const canManageDivisions = hasCapability(roles, 'manage_divisions_directory');
  const canGenerateQr = hasCapability(roles, 'generate_qr_codes');
  const canEditContent = hasCapability(roles, 'manage_site_content');
  const canViewAdmin = hasCapability(roles, 'view_admin_dashboard');
  const canViewDocs = hasCapability(roles, 'view_docs');
  const canManageDocs = hasCapability(roles, 'manage_docs');
  const canManageRoles = hasCapability(roles, 'manage_roles');
  const canViewPhotoAlbums = hasCapability(roles, 'view_photo_albums');
  const canManagePhotoAlbums = hasCapability(roles, 'manage_photo_albums');
  // A separate, lighter tool from the full exec/admin directory manager
  // below — gated on actually holding the 'division' role itself (not the
  // broader manage_division capability, which lead/exec/admin also hold),
  // so it only shows up for the people the full directory tool doesn't
  // already cover, instead of duplicating that entry point for everyone.
  const isDivisionLead = roles.some((r) => r.role === 'division');

  // Every section a user can reach is fetched here, in parallel, capability
  // by capability — a plain member only ever triggers the tickets query. The
  // hub then just renders whichever of these were fetched; nothing is
  // re-fetched client-side when a card opens.
  const [ticketsData, checkinData, eventsData, membersData, divisionsData, myDivisions, contentData, adminData, statsData, docsData, roleHistoryData, photoAlbumsData] =
    await Promise.all([
      getTicketsData(profile.id, roles),
      canCheckin ? getCheckinData() : Promise.resolve(null),
      canViewEvents ? getEventsData() : Promise.resolve(null),
      canViewMembers ? getMembersData() : Promise.resolve(null),
      canManageDivisions ? getDivisionsData() : Promise.resolve(null),
      isDivisionLead ? getMyDivisionsData(roles) : Promise.resolve(null),
      canEditContent ? getContentData() : Promise.resolve(null),
      canViewAdmin ? getAdminData(roles) : Promise.resolve(null),
      canViewAdmin ? getStatsData() : Promise.resolve(null),
      canViewDocs ? getDocsData() : Promise.resolve(null),
      canManageRoles ? getRoleHistoryData() : Promise.resolve(null),
      canViewPhotoAlbums ? getPhotoAlbumsData() : Promise.resolve(null),
    ]);

  // getHours() reads the server process's own runtime clock, which on most
  // hosts isn't Pacific (often UTC) — this is the club's own dashboard, so
  // "morning"/"evening" should track San Diego's clock, not whatever region
  // the server happens to be deployed in.
  const rawHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', hour12: false }).format(new Date()));
  const hour = rawHour === 24 ? 0 : rawHour; // some engines render midnight as "24" with hour12:false
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
      id: 'tickets', icon: <Ticket size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'My Tickets',
      description: 'View and show your event tickets',
      badge: activeTicketCount || undefined,
      group: 'Yours',
      content: <TicketsClient tickets={ticketsData.tickets} upcomingEvents={ticketsData.upcomingEvents} isUcsd={ticketsData.isUcsd} />,
    },
    {
      id: 'profile', icon: <User size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Profile',
      description: 'Update your info and preferences',
      group: 'Yours',
      content: <ProfileClient profile={profile} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} />,
    },
    {
      id: 'activity', icon: <History size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Activity',
      description: 'Your registrations and check-ins',
      group: 'Yours',
      content: <ActivitySectionContent tickets={ticketsData.tickets} />,
    },
    ...(canViewEvents && eventsData ? [{
      id: 'events', icon: <Calendar size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Events',
      description: canManageEvents ? 'Create and manage events' : 'Browse upcoming and past events',
      group: 'Events' as const,
      content: (
        <EventsSectionContent
          events={eventsData.events}
          eventsPerMonth={eventsData.eventsPerMonth}
          ticketsPerMonth={eventsData.ticketsPerMonth}
          eventStats={eventsData.eventStats}
          canEdit={canManageEvents}
        />
      ),
    }] : []),
    ...(canCheckin && checkinData ? [{
      id: 'checkin', icon: <Camera size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Check-In Scanner',
      description: 'Scan tickets to check people in',
      group: 'Events' as const,
      content: <CheckInClient events={checkinData.events} />,
    }] : []),
    ...(canViewMembers && membersData ? [{
      id: 'members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Members',
      description: 'Browse everyone in the org',
      badge: membersData.rows.length || undefined,
      group: 'Resources' as const,
      content: <MembersSectionContent rows={membersData.rows} roles={roles} />,
    }] : []),
    ...(canViewDocs && docsData ? [{
      id: 'docs', icon: <BookOpen size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Documentation',
      group: 'Resources' as const,
      description: 'How-to guides for officers, leads, and execs',
      badge: docsData.docs.length || undefined,
      content: <DocsClient initialDocs={docsData.docs} initialCategories={docsData.categories} userId={profile.id} canEdit={canManageDocs} />,
    }] : []),
    // In Resources, not Admin — generate_qr_codes is granted to every
    // officer-tier role (officer/division/lead/exec/admin, see
    // capabilities.ts), the same "any actual TG member" audience as
    // Members/Docs below, not an admin-only power. Admin is for the
    // genuinely admin-restricted stuff (role grants, site content, system
    // stats) — grouping a widely-usable tool in with that mislabeled who
    // it's actually for.
    ...(canGenerateQr ? [{
      id: 'qrcode', icon: <QrCode size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'QR Studio',
      description: 'Design branded QR codes',
      group: 'Resources' as const,
      content: <QRStudioClient />,
    }] : []),
    // Same Resources audience as Members/Docs/QR Studio (officer-tier and
    // up), but also explicitly opened to recruit/alumni — browsing old
    // event photos is exactly what a prospect or a former member would
    // want, unlike the more ops-focused cards next to it.
    ...(canViewPhotoAlbums && photoAlbumsData ? [{
      id: 'albums', icon: <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Photo Albums',
      description: 'Google Photos albums from past events',
      badge: photoAlbumsData.albums.length || undefined,
      group: 'Resources' as const,
      content: <PhotoAlbumsSectionContent albums={photoAlbumsData.albums} canManage={canManagePhotoAlbums} />,
    }] : []),
    // One card for everything that boils down to "edit what shows on the
    // public site" — used to be three separate Admin-group cards (Divisions
    // directory, My Division, Edit Site Content), which buried each behind
    // its own click and made "Admin" a mix of unrelated concerns (roles,
    // stats, AND content editing). See SiteContentSectionContent for the
    // tabbed layout, matching AdminSectionContent's own tab bar.
    ...(canManageDivisions || isDivisionLead || canEditContent ? [{
      id: 'site-content', icon: <Pencil size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Site Content',
      description: 'Divisions, page banners, and text on the public site',
      group: 'Admin' as const,
      content: (
        <SiteContentSectionContent
          canEditContent={canEditContent}
          contentBlocks={CONTENT_BLOCKS}
          contentMap={contentData?.contentMap}
          lastEdited={contentData?.lastEdited}
          canManageDivisions={canManageDivisions}
          allDivisions={divisionsData?.divisions}
          isDivisionLead={isDivisionLead}
          myDivisions={myDivisions ?? undefined}
        />
      ),
    }] : []),
    ...(canViewAdmin && adminData && statsData ? [{
      id: 'admin', icon: <Shield size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Admin',
      description: 'Stats, roles, analytics, and audit history',
      group: 'Admin' as const,
      content: (
        <AdminSectionContent
          {...adminData}
          statsData={statsData}
          roleHistoryEntries={canManageRoles ? roleHistoryData?.entries : undefined}
        />
      ),
    }] : []),
  ];

  const avatarUrl = resolveAvatarUrl(profile);

  return (
    <div className={styles.page}>
      {/* Shares one gap between the greeting, the checkin/next-ticket
          banners, and the hub below — previously the hub alone got a
          bordered "shell" (see PortalHub.module.css's .desktopShell) while
          everything above it stayed borderless, which read as two
          disconnected pieces of UI. See dashboard.module.css's
          .dashboardCard for why plain spacing won out over a boxed card. */}
      <div className={styles.dashboardCard}>
        <header className={styles.header}>
          <Image
            src="/bytes/byte_tgex25.png"
            alt=""
            width={723}
            height={723}
            aria-hidden="true"
            className={styles.mascotAccent}
          />
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
                  [...roles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role]).map((r) => (
                    <span
                      key={`${r.role}-${r.division_id ?? ''}`}
                      className={styles.roleChip}
                      style={{ background: ROLE_COLORS[r.role] + '18', color: ROLE_COLORS[r.role], borderColor: ROLE_COLORS[r.role] + '44' }}
                    >
                      {/* A person can lead more than one division now — name it on
                          the chip, otherwise two "Division Lead" chips in a row
                          look like a duplicate/bug rather than two real grants. */}
                      {r.role === 'division' && r.division_id
                        ? `${ROLE_LABELS.division} — ${divisionNameById.get(r.division_id) ?? 'Unknown'}`
                        : ROLE_LABELS[r.role]}
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
            <span className={styles.checkinBannerIcon}><Camera size={24} strokeWidth={1.5} aria-hidden="true" /></span>
          </Link>
        )}

        {/* The "next ticket" banner is shown to anyone with an upcoming
            ticket, regardless of role — an exec/lead/officer who also has
            their own ticket to an event is still an attendee of it, so
            hiding this from them (the previous `!canManageEvents` gate) just
            meant they never got the reminder. PortalTopSection owns matching
            its width to the hub grid below it. */}
        <PortalTopSection
          ticket={nextTicket ? (nextTicket as Parameters<typeof DashboardClient>[0]['ticket']) : null}
          sections={sections}
        />
      </div>
    </div>
  );
}
