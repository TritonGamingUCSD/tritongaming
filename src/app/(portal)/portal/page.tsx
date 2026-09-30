import Link from 'next/link';
import Image from 'next/image';
import { Ticket, User, Camera, Calendar, Users, Gamepad2, QrCode, Pencil, Shield, BookOpen, History, Image as ImageIcon, Award, Medal } from 'lucide-react';
import { getProfile, getUserRoles } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { hasCapability, isVerifiedMember, isRewardsEligible } from '@/lib/capabilities';
import { resolveAvatarUrl } from '@/lib/profile';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import { PACIFIC_TZ, pacificDaysUntil } from '@/lib/timezone';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';
import { getDivisions } from '@/lib/divisions';
import type { HubSection } from '@/components/portal/PortalHub';
import SignOutButton from '@/components/portal/SignOutButton';
import OnboardingGuide from '@/components/portal/OnboardingGuide';
import DashboardClient from './DashboardClient';
import PortalTopSection from './PortalTopSection';
import PortalSearch from '@/components/portal/PortalSearch';
import TicketsClient from './tickets/TicketsClient';
import { getTicketsData } from './tickets/getTicketsData';
import ProfileClient from './profile/ProfileClient';
import CheckInSectionContent from './checkin/CheckInSectionContent';
import { getCheckinData } from './checkin/getCheckinData';
import PointsSectionContent from './points/PointsSectionContent';
import { getMyPointsData } from './points/getMyPointsData';
import BattlepassSectionContent from './battlepass/BattlepassSectionContent';
import { getMyBattlepassData } from './battlepass/getMyBattlepassData';
import { BATTLEPASS_ROLES, getOfficerTier, fetchOfficerTiers } from '@/lib/officerTiers';
import { getTier, fetchTiers } from '@/lib/tiers';
import EventsSectionContent from './events/EventsSectionContent';
import { getEventsData, getCheckinFormSettings } from './events/getEventsData';
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

interface Props {
  // Next's async searchParams (App Router convention) — lets a link like
  // /portal?section=points&tab=shop both open a hub section AND land on one
  // of its internal tabs, instead of only ever opening to that section's
  // first tab. `tab` is handed to every multi-tab section unconditionally;
  // each one only honors it if it's actually one of its own tab ids and
  // ignores it otherwise, so there's no coordination needed between
  // sections about which tab names are whose.
  searchParams: Promise<{ tab?: string; subtab?: string }>;
}

export default async function PortalDashboard({ searchParams }: Props) {
  const { tab: requestedTab, subtab: requestedSubTab } = await searchParams;
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
  const canManageRewardsShop = hasCapability(roles, 'manage_rewards_shop');
  const canScanRedemptions = hasCapability(roles, 'scan_redemptions');
  const canManagePoints = hasCapability(roles, 'manage_points');
  // Rewards (earning points at check-in, referral bonuses, the shop) is
  // UCSD-students-and-staff only — see is_rewards_eligible() in
  // 20260922110000_restrict_rewards_to_ucsd.sql, the actual enforcement
  // boundary; this just keeps the section/badge from showing at all to
  // someone who'd hit a permission error the moment they tried to use it.
  const canUseRewards = isRewardsEligible(roles);
  // A separate, lighter tool from the full exec/admin directory manager
  // below — gated on actually holding the 'division' role itself (not the
  // broader manage_division capability, which lead/exec/admin also hold),
  // so it only shows up for the people the full directory tool doesn't
  // already cover, instead of duplicating that entry point for everyone.
  const isDivisionLead = roles.some((r) => r.role === 'division');
  // The Battlepass is a fully separate system from member Rewards (see
  // 20260921100000_add_officer_points_system.sql) — only officer-tier
  // role holders have one at all.
  const isOfficerTier = roles.some((r) => BATTLEPASS_ROLES.includes(r.role));

  // Every section a user can reach is fetched here, in parallel, capability
  // by capability — a plain member only ever triggers the tickets query. The
  // hub then just renders whichever of these were fetched; nothing is
  // re-fetched client-side when a card opens.
  const supabase = await createClient();
  const [ticketsData, checkinData, eventsData, checkinFormSettings, membersData, divisionsData, myDivisions, contentData, adminData, statsData, docsData, roleHistoryData, photoAlbumsData, pointsData, battlepassData, memberTiers, officerTiers] =
    await Promise.all([
      getTicketsData(profile.id, roles),
      canCheckin ? getCheckinData() : Promise.resolve(null),
      canViewEvents ? getEventsData() : Promise.resolve(null),
      canManageEvents ? getCheckinFormSettings() : Promise.resolve(undefined),
      canViewMembers ? getMembersData() : Promise.resolve(null),
      canManageDivisions ? getDivisionsData() : Promise.resolve(null),
      isDivisionLead ? getMyDivisionsData(roles) : Promise.resolve(null),
      canEditContent ? getContentData() : Promise.resolve(null),
      canViewAdmin ? getAdminData(roles) : Promise.resolve(null),
      canViewAdmin ? getStatsData() : Promise.resolve(null),
      canViewDocs ? getDocsData() : Promise.resolve(null),
      canManageRoles ? getRoleHistoryData() : Promise.resolve(null),
      canViewPhotoAlbums ? getPhotoAlbumsData() : Promise.resolve(null),
      canUseRewards ? getMyPointsData(profile.id) : Promise.resolve(null),
      isOfficerTier ? getMyBattlepassData(profile.id) : Promise.resolve(null),
      fetchTiers(supabase),
      isOfficerTier ? fetchOfficerTiers(supabase) : Promise.resolve([]),
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
  // A ticket's status never actually flips away from 'active' once its
  // event ends (see isCheckinWindowOpen/performCheckin) — counting bare
  // status alone here made the "My Tickets" badge and this header stat
  // keep counting tickets to events from weeks ago as if they still needed
  // attention.
  const activeTicketCount = ticketsData.tickets.filter((t) => t.status === 'active' && t.event && isCheckinWindowOpen(t.event)).length;
  // Same "already have a ticket to this one" exclusion TicketsClient itself
  // uses (registeredEventIds there) — the Hub preview shouldn't invite
  // someone to an event they're already registered for.
  const registeredEventIds = new Set(ticketsData.tickets.map((t) => t.event?.id).filter(Boolean));
  const unregisteredUpcomingEvents = ticketsData.upcomingEvents.filter((e) => !registeredEventIds.has(e.id));
  const memberTier = pointsData ? getTier(pointsData.lifetimeEarned, memberTiers) : null;
  const officerTier = battlepassData ? getOfficerTier(battlepassData.lifetimeEarned, officerTiers) : null;

  // Events on today's Pacific calendar date, for the check-in shortcut
  // banner — derived from checkinData (already scoped to "recent or soon")
  // instead of a second query. A raw `<= now + 24h` window (the previous
  // check) mislabels an event happening tomorrow morning as "today"
  // whenever it's less than 24h away by the clock — e.g. checking at
  // 11pm for an event at 6am the next day. pacificDaysUntil compares
  // actual Pacific calendar dates instead, so this only ever matches
  // events that fall on San Diego's "today", no matter what time it is now.
  const todayEvents = (checkinData?.events ?? []).filter((e) => pacificDaysUntil(e.start_date) === 0);

  const sections: HubSection[] = [
    {
      id: 'tickets', icon: <Ticket size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'My Tickets',
      description: 'View and show your event tickets',
      badge: activeTicketCount || undefined,
      group: 'Yours',
      content: <TicketsClient tickets={ticketsData.tickets} upcomingEvents={ticketsData.upcomingEvents} isUcsd={ticketsData.isUcsd} canEarnPoints={ticketsData.canEarnPoints} />,
    },
    {
      id: 'profile', icon: <User size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Profile',
      description: 'Update your info and preferences',
      group: 'Yours',
      content: <ProfileClient profile={profile} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} initialTab={requestedTab} />,
    },
    {
      id: 'activity', icon: <History size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Activity',
      description: 'Your registrations and check-ins',
      group: 'Yours',
      content: <ActivitySectionContent tickets={ticketsData.tickets} />,
    },
    ...(canUseRewards && pointsData ? [{
      id: 'points', icon: <Award size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Rewards',
      description: 'Earn points for showing up, spend them on perks',
      badge: pointsData.balance || undefined,
      group: 'Yours' as const,
      content: (
        <PointsSectionContent
          balance={pointsData.balance}
          lifetimeEarned={pointsData.lifetimeEarned}
          referralCode={pointsData.referralCode ?? ''}
          leaderboardAnonymous={pointsData.leaderboardAnonymous}
          transactions={pointsData.transactions}
          canManageShop={canManageRewardsShop}
          canManagePoints={canManagePoints}
          initialTab={requestedTab}
          initialSubTab={requestedSubTab}
          tiers={memberTiers}
        />
      ),
    }] : []),
    ...(isOfficerTier && battlepassData ? [{
      id: 'battlepass', icon: <Medal size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Battlepass',
      description: 'Recognition for officer-specific contributions',
      badge: battlepassData.balance || undefined,
      group: 'Yours' as const,
      content: (
        <BattlepassSectionContent
          balance={battlepassData.balance}
          lifetimeEarned={battlepassData.lifetimeEarned}
          leaderboardAnonymous={battlepassData.leaderboardAnonymous}
          transactions={battlepassData.transactions}
          canManagePoints={canManagePoints}
          initialTab={requestedTab}
          initialSubTab={requestedSubTab}
          tiers={officerTiers}
        />
      ),
    }] : []),
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
          canDelete={hasCapability(roles, 'delete_events')}
          canManagePoints={canManagePoints}
          initialTab={requestedTab}
          checkinFormSettings={checkinFormSettings ?? undefined}
        />
      ),
    }] : []),
    ...(canCheckin && checkinData ? [{
      id: 'checkin', icon: <Camera size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Check-In',
      description: 'Scan tickets, confirm redemptions, or reveal the online check-in code',
      group: 'Events' as const,
      content: <CheckInSectionContent events={checkinData.events} canScanRedemptions={canScanRedemptions} initialTab={requestedTab} tiers={memberTiers} />,
    }] : []),
    ...(canViewMembers && membersData ? [{
      id: 'members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Members',
      description: 'Browse everyone in the org',
      // Not rows.length — that counts every profile including plain
      // verified-student accounts who never joined anything, which the
      // Members page itself excludes. This badge would otherwise promise a
      // much bigger roster than the page actually shows.
      badge: membersData.memberCount || undefined,
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
          initialTab={requestedTab}
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
          initialTab={requestedTab}
        />
      ),
    }] : []),
  ];

  const avatarUrl = resolveAvatarUrl(profile);

  return (
    <div className={styles.page}>
      {!profile.onboarded_at && <OnboardingGuide userId={profile.id} />}

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

              {/* At-a-glance stats — added once there was actually enough
                  going on (points/tier, Battlepass, tickets) that landing on
                  the dashboard and seeing only a name + role chips undersold
                  it. Each badge deep-links straight to that section's own
                  tab (see the initialTab wiring below) rather than just the
                  section's default view. */}
              <div className={styles.statBadges}>
                {pointsData && memberTier && (
                  <Link href="/portal?section=points&tab=points" className={styles.statBadge} style={{ borderColor: `${memberTier.color}55` }}>
                    <Award size={13} strokeWidth={1.75} aria-hidden="true" style={{ color: memberTier.color }} />
                    <span>{pointsData.balance.toLocaleString()} pts</span>
                    <span className={styles.statBadgeTier} style={{ color: memberTier.color }}>{memberTier.name}</span>
                  </Link>
                )}
                {battlepassData && (
                  <Link href="/portal?section=battlepass&tab=mine" className={styles.statBadge} style={{ borderColor: `${officerTier?.color}55` }}>
                    <Medal size={13} strokeWidth={1.75} aria-hidden="true" style={{ color: officerTier?.color }} />
                    <span>{battlepassData.balance.toLocaleString()} pts</span>
                    <span className={styles.statBadgeTier} style={{ color: officerTier?.color }}>{officerTier?.name}</span>
                  </Link>
                )}
                {activeTicketCount > 0 && (
                  <Link href="/portal?section=tickets" className={styles.statBadge}>
                    <Ticket size={13} strokeWidth={1.75} aria-hidden="true" />
                    <span>{activeTicketCount} active ticket{activeTicketCount === 1 ? '' : 's'}</span>
                  </Link>
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

        {/* Mobile-only (desktop already has its own persistent search in
            DesktopShell's rail — see PortalHub.tsx — showing both would be
            a duplicate). Sits above the checkin banner and ticket/events
            content, right below the greeting header. */}
        <div className={styles.mobileSearchWrap}>
          <PortalSearch />
        </div>

        {canCheckin && todayEvents.length > 0 && (
          <Link href="/portal?section=checkin" className={styles.checkinBanner}>
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
          upcomingEvents={unregisteredUpcomingEvents}
          sections={sections}
        />
      </div>
    </div>
  );
}
