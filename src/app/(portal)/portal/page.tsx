import Link from 'next/link';
import Image from 'next/image';
import { Ticket, User, Camera, Calendar, Users, Gamepad2, QrCode, Pencil, Shield, BookOpen, Image as ImageIcon, Award, Medal, ArrowLeft, CalendarCheck, CalendarDays, LayoutGrid, LifeBuoy, CalendarHeart } from 'lucide-react';
import { getProfile, getUserRoles, getMyPrivateProfile, getUser, getRealRoles, getViewAs } from '@/lib/auth';
import { ViewAsSwitcher } from '@/components/portal/ViewAs';
import { createClient } from '@/lib/supabase/server';
import { hasCapability, isVerifiedMember, isRewardsEligible } from '@/lib/capabilities';
import { resolveAvatarUrl } from '@/lib/profile';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { CONTENT_BLOCKS } from '@/lib/content-blocks';
import { PACIFIC_TZ, pacificDaysUntil } from '@/lib/timezone';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';
import { getDivisions, divisionLogoSrc } from '@/lib/divisions';
import type { HubSection } from '@/components/portal/PortalHub';
import SignOutButton from '@/components/portal/SignOutButton';
import OnboardingGuide from '@/components/portal/OnboardingGuide';
import DashboardClient from './DashboardClient';
import PortalTopSection from './PortalTopSection';
import PortalSearch from '@/components/portal/PortalSearch';
import TicketsSectionContent from './tickets/TicketsSectionContent';
import { getTicketsData } from './tickets/getTicketsData';
import ProfileClient from './profile/ProfileClient';
import CheckInSectionContent from './checkin/CheckInSectionContent';
import { getCheckinData } from './checkin/getCheckinData';
import PointsSectionContent from './points/PointsSectionContent';
import { getMyPointsData } from './points/getMyPointsData';
import BattlepassSectionContent from './battlepass/BattlepassSectionContent';
import { getMyBattlepassData } from './battlepass/getMyBattlepassData';
import { BATTLEPASS_ROLES, getOfficerTier, fetchOfficerTiers } from '@/lib/officerTiers';
import { getTier, nextTier, fetchTiers } from '@/lib/tiers';
import EventsSectionContent from './events/EventsSectionContent';
import { getEventsData } from './events/getEventsData';
import MembersSectionContent from './members/MembersSectionContent';
import { getMembersData } from './members/getMembersData';
import { getDivisionsData } from './divisions/getDivisionsData';
import { getMyDivisionsData } from './divisions/getMyDivisionsData';
import QRStudioClient from './qrcode/QRStudioClient';
import { redirect } from 'next/navigation';
import DivisionMembersSectionContent from './division-members/DivisionMembersSectionContent';
import { getDivisionMembersData } from './division-members/getDivisionMembersData';
import DivisionsSectionContent from './divisions/DivisionsSectionContent';
import SiteContentSectionContent from './content/SiteContentSectionContent';
import { getContentData } from './admin/content/getContentData';
import AdminSectionContent from './admin/AdminSectionContent';
import MeetingsSectionContent from './meetings/MeetingsSectionContent';
import { createServiceClient } from '@/lib/supabase/admin';
import HelpSectionContent from './help/HelpSectionContent';
import CalendarSectionContent from './calendar/CalendarSectionContent';
import InternalEventsSectionContent from './internal-events/InternalEventsSectionContent';
import { meetingHappeningNow } from '@/lib/meetings';
import { getAdminData } from './admin/getAdminData';
import { getStatsData } from './admin/stats/getStatsData';
import DocsClient from './docs/DocsClient';
import { getDocsData } from './docs/getDocsData';
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
  searchParams: Promise<{ tab?: string; subtab?: string; section?: string }>;
}

export default async function PortalDashboard({ searchParams }: Props) {
  const { tab: requestedTab, subtab: requestedSubTab, section: requestedSection } = await searchParams;
  // Short Links is a tab of Admin now.
  if (requestedSection === 'activity') redirect('/portal?section=tickets&tab=history');
  if (requestedSection === 'socials' || requestedSection === 'team-events') redirect('/portal?section=internal-events');
  if (requestedSection === 'links') redirect('/portal?section=admin&tab=links');
  // Division tabs used to live inside Site Content; old links land on the new Divisions section.
  if (requestedSection === 'site-content' && (requestedTab === 'divisions' || requestedTab === 'my-division')) {
    redirect(`/portal?section=divisions&tab=${requestedTab === 'divisions' ? 'directory' : 'my-division'}`);
  }
  // divisions is fetched unconditionally (cheap, publicly-readable table) —
  // needed to label a division-lead role chip with *which* division below,
  // regardless of whether this user themselves can manage the directory.
  const [profile, roles, divisions, myGender, authUser] = await Promise.all([getProfile(), getUserRoles(), getDivisions(), getMyPrivateProfile(), getUser()]);
  if (!profile) return null;
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));
  // Admins (their REAL roles) get the "View as" menu.
  const [realRoles, viewAs] = await Promise.all([getRealRoles(), getViewAs()]);
  const canViewAs = realRoles.some((r) => r.role === 'admin');

  const canViewEvents = hasCapability(roles, 'view_events');
  const canManageEvents = hasCapability(roles, 'manage_events');
  const canCheckin = hasCapability(roles, 'checkin');
  const canViewMembers = hasCapability(roles, 'view_members');
  // Division leads and the whole team can see who leads each division; emails stay officer+ only.
  const canSeeDivisionMembers = hasCapability(roles, 'view_division_members');
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
  const canAttendMeetings = hasCapability(roles, 'attend_meetings');
  const canViewAttendanceReports = hasCapability(roles, 'view_attendance_reports');
  const canManageMeetings = hasCapability(roles, 'manage_meetings');   // exec/admin: every meeting + HR export
  const canViewInternalEvents = hasCapability(roles, 'view_internal_events');
  const canHostInternalEvents = hasCapability(roles, 'host_internal_events');
  const canHostMeetings = hasCapability(roles, 'host_meetings');         // leads too: plan meetings, manage their own
  // Best-effort: if this lookup fails the bar just doesn't get the meeting boost.
  const meetingNow = canAttendMeetings ? await meetingHappeningNow(createServiceClient(), { id: profile.id, roles }).catch(() => false) : false;
  // Help tickets: exec/admin see how many are waiting on them; everyone else how many have a new reply.
  const canHandleHelp = hasCapability(roles, 'manage_help');
  const helpWaiting = await (async () => {
    try {
      const svc = createServiceClient();
      let q = svc.from('help_tickets').select('id', { count: 'exact', head: true }).neq('status', 'resolved');
      q = canHandleHelp ? q.eq('last_from_user', true) : q.eq('user_id', profile.id).eq('last_from_user', false);
      return (await q).count ?? 0;
    } catch { return 0; }
  })();
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
  const [ticketsData, checkinData, eventsData, membersData, divisionsData, myDivisions, contentData, adminData, statsData, docsData, roleHistoryData, photoAlbumsData, pointsData, battlepassData, memberTiers, officerTiers] =
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

  // Not "starts in the future" — that dropped the featured ticket the
  // instant its event began, mid-event. Anything whose check-in window is
  // still open counts (an event underway sorts first).
  const nextTicket = ticketsData.tickets
    .filter((t) => t.status === 'active' && t.event && isCheckinWindowOpen(t.event))
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
  const memberNext = pointsData ? nextTier(pointsData.lifetimeEarned, memberTiers) : null;
  const officerNext = battlepassData ? nextTier(battlepassData.lifetimeEarned, officerTiers) : null;

  // Events on today's Pacific calendar date, for the check-in shortcut
  // banner — derived from checkinData (already scoped to "recent or soon")
  // instead of a second query. A raw `<= now + 24h` window (the previous
  // check) mislabels an event happening tomorrow morning as "today"
  // whenever it's less than 24h away by the clock — e.g. checking at
  // 11pm for an event at 6am the next day. pacificDaysUntil compares
  // actual Pacific calendar dates instead, so this only ever matches
  // events that fall on San Diego's "today", no matter what time it is now.
  const todayEvents = (checkinData?.events ?? []).filter((e) => pacificDaysUntil(e.start_date) === 0);

  const divisionMembersData = canSeeDivisionMembers ? await getDivisionMembersData(canViewMembers).catch(() => []) : null;

  const sections: HubSection[] = [
    {
      id: 'tickets', icon: <Ticket size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'My Tickets',
      description: 'View and show your event tickets',
      badge: activeTicketCount || undefined,
      // A ticket for something today or tomorrow is what you'll want in your thumb's reach.
      dockBoost: nextTicket?.event && pacificDaysUntil(nextTicket.event.start_date) <= 1 ? 60 : 0,
      group: 'Yours',
      content: <TicketsSectionContent tickets={ticketsData.tickets} upcomingEvents={ticketsData.upcomingEvents} isUcsd={ticketsData.isUcsd} canEarnPoints={ticketsData.canEarnPoints} activity={ticketsData.tickets} />,
    },
    {
      id: 'profile', icon: <User size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Profile', railHidden: true,  // opened from your name at the top of the sidebar
      description: 'Update your info and preferences',
      group: 'Yours',
      content: <ProfileClient profile={profile} privateInfo={myGender} email={authUser?.email ?? null} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} initialTab={requestedTab} />,
    },
    {
      id: 'help', icon: <LifeBuoy size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Help', railHidden: true,  // a button in the sidebar footer
      description: canHandleHelp ? 'Answer questions and problems from members' : 'Ask a question or report a problem',
      badge: helpWaiting || undefined,
      group: 'Resources',
      content: <HelpSectionContent isStaff={canHandleHelp} userId={profile.id} />,
    },
    ...(canUseRewards && pointsData ? [{
      id: 'points', icon: <Award size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Rewards',
      // Officers, leads, exec and admins have the Battlepass; Rewards never takes a bottom-bar slot for them.
      dockExclude: roles.some((r) => ['officer', 'lead', 'exec', 'admin'].includes(r.role)),
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
      group: 'TG' as const,
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
    {
      id: 'calendar', icon: <CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Calendar',
      description: 'Events and the meetings you’re invited to',
      group: 'Overview' as const,
      content: <CalendarSectionContent />,
    },
    ...(canViewEvents && eventsData ? [{
      id: 'events', icon: <Calendar size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Events',
      description: canManageEvents ? 'Create and manage events' : 'Browse upcoming and past events',
      dockBoost: canManageEvents ? 35 : 0,
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
        />
      ),
    }] : []),
    ...(canCheckin && checkinData ? [{
      id: 'checkin', icon: <Camera size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Check-In',
      description: 'Scan tickets, confirm redemptions, or reveal the online check-in code',
      // Staff on a day with an event: the scanner is the one thing they need.
      dockBoost: todayEvents.length > 0 ? 90 : 0,
      group: 'Events' as const,
      content: <CheckInSectionContent events={checkinData.events} canScanRedemptions={canScanRedemptions} initialTab={requestedTab} tiers={memberTiers} />,
    }] : []),
    ...(canAttendMeetings || canViewAttendanceReports ? [{
      id: 'meetings', icon: <CalendarCheck size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Meetings',
      description: !canAttendMeetings ? 'Attendance results' : canManageMeetings ? 'Schedule meetings, run check-in, export attendance' : canHostMeetings ? 'Plan your meetings, run check-in, see results' : 'Check in to meetings and see your history',
      // While a meeting is on (or about to start) this is the thing to have under your thumb.
      dockBoost: (meetingNow ? 100 : 0) + (canManageMeetings ? 10 : 0),
      group: 'TG' as const,
      content: <MeetingsSectionContent canHost={canHostMeetings} canManageAll={canManageMeetings} userId={profile.id} canAttend={canAttendMeetings} canViewReports={canViewAttendanceReports} />,
    }] : []),
    ...(canViewInternalEvents ? [{
      id: 'internal-events', icon: <CalendarHeart size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Internal Events',
      description: canHostInternalEvents ? 'Plan internal events and see who’s coming' : 'Socials, trainings and other internal events',
      group: 'TG' as const,
      content: <InternalEventsSectionContent canHost={canHostInternalEvents} />,
    }] : []),
    ...(canViewMembers && membersData ? [{
      id: 'members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'TG Members',
      description: 'Browse everyone in the org',
      // Not rows.length — that counts every profile including plain
      // verified-student accounts who never joined anything, which the
      // Members page itself excludes. This badge would otherwise promise a
      // much bigger roster than the page actually shows.
      badge: membersData.memberCount || undefined,
      group: 'TG' as const,
      content: <MembersSectionContent rows={membersData.rows} />,
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
      content: <QRStudioClient divisions={divisions.filter((d) => d.logo_url).map((d) => ({ id: d.id, name: d.name, logo: divisionLogoSrc(d.logo_url) ?? '' })).filter((d) => d.logo)} />,
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
    ...(canManageDivisions || isDivisionLead ? [{
      id: 'divisions', icon: <LayoutGrid size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Divisions',
      description: canManageDivisions ? 'Manage the divisions directory and their pages' : 'Edit your division’s page',
      group: 'Divisions' as const,
      content: (
        <DivisionsSectionContent
          canManageDivisions={canManageDivisions}
          allDivisions={divisionsData?.divisions}
          isDivisionLead={isDivisionLead}
          myDivisions={myDivisions ?? undefined}
        />
      ),
    }] : []),
    ...(canSeeDivisionMembers ? [{
      id: 'division-members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Division Members',
      description: 'Who leads each division',
      group: 'Divisions' as const,
      content: <DivisionMembersSectionContent groups={divisionMembersData ?? []} />,
    }] : []),
    ...(canEditContent ? [{
      id: 'site-content', icon: <Pencil size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Site Content',
      description: 'Page banners, text and images on the public site',
      group: 'Admin' as const,
      content: (
        <SiteContentSectionContent
          canEditContent={canEditContent}
          contentBlocks={CONTENT_BLOCKS}
          contentMap={contentData?.contentMap}
          lastEdited={contentData?.lastEdited}
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
  // Every role the person holds (shown as chips in the sidebar), highest first.
  // Roles for display only: permissions granted straight to the person (Admin → Access) are not roles.
  const heldRoles = roles.filter((r) => !String(r.role).startsWith('cap:'));
  const roleChips = (heldRoles.length === 0 ? [{ role: 'guest' as const, division_id: null as string | null }] : [...heldRoles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role])).map((r) => ({
    label: r.role === 'division' && r.division_id ? `${ROLE_LABELS.division} — ${divisionNameById.get(r.division_id) ?? 'Unknown'}` : ROLE_LABELS[r.role],
    color: ROLE_COLORS[r.role],
  }));
  const primaryRoleLabel = heldRoles.length === 0
    ? ROLE_LABELS.guest
    : ROLE_LABELS[[...heldRoles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role])[0].role];

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
        {/* The "next ticket" banner is shown to anyone with an upcoming
            ticket, regardless of role — an exec/lead/officer who also has
            their own ticket to an event is still an attendee of it, so
            hiding this from them (the previous `!canManageEvents` gate) just
            meant they never got the reminder. PortalTopSection owns matching
            its width to the hub grid below it. */}
        <PortalTopSection
          top={
            <>
            <header className={styles.welcome}>
              <Image src="/bytes/byte_tgex25.png" alt="" width={723} height={723} aria-hidden="true" className={styles.welcomeMascot} />
              <div className={styles.welcomeMain}>
                <Link href="/portal?section=profile" className={styles.welcomeAvatarLink} aria-label="Open your profile">
                {avatarUrl ? (
                    <Image src={avatarUrl} alt={profile.display_name || 'User'} width={48} height={48} className={styles.welcomeAvatar} unoptimized referrerPolicy="no-referrer" />
                  ) : (
                    <div className={styles.welcomeAvatarFallback}>{(profile.display_name || 'U')[0].toUpperCase()}</div>
                  )}
                </Link>
              <div className={styles.welcomeText}>
                  <h1 className={styles.welcomeName} data-greeting={greeting}>{profile.display_name?.split(' ')[0] || 'Triton'}</h1>
                  <div className={styles.roleChips}>
                    {heldRoles.length === 0 ? (
                      <span className={styles.roleChip} style={{ background: ROLE_COLORS.guest + '18', color: ROLE_COLORS.guest, borderColor: ROLE_COLORS.guest + '44' }}>
                        {ROLE_LABELS.guest}
                      </span>
                    ) : (
                      [...heldRoles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role]).map((r) => (
                        <span
                          key={`${r.role}-${r.division_id ?? ''}`}
                          className={styles.roleChip}
                          style={{ background: ROLE_COLORS[r.role] + '18', color: ROLE_COLORS[r.role], borderColor: ROLE_COLORS[r.role] + '44' }}
                        >
                          {/* A person can lead more than one division — name it on the chip so two
                              "Division Lead" chips don't read as a duplicate. */}
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

              {canViewAs && <div className={styles.viewAsSlot}><ViewAsSwitcher active={viewAs} /></div>}

              {/* Mobile only: search lives inside the header card (desktop has it in the pinned header). */}
          <div className={styles.welcomeSearch}><PortalSearch compact /></div>

          {/* At-a-glance stats — each tile deep-links to that section's own tab. */}
              {(pointsData || battlepassData || activeTicketCount > 0) && (
                <div className={styles.tiles}>
                  {pointsData && memberTier && (
                    <Link href="/portal?section=points&tab=points" className={styles.tile} style={{ ['--tile-accent' as string]: memberTier.color }}>
                      <span className={styles.tileTop}><Award size={15} strokeWidth={1.75} aria-hidden="true" /> Rewards</span>
                      <span className={styles.tileValue}>{pointsData.balance.toLocaleString()}<span className={styles.tileUnit}> pts</span></span>
                      <span className={styles.tileTier}>{memberTier.name}</span>
                      {memberNext && (
                        <span className={styles.tileProgress} title={`${memberNext.min - pointsData.lifetimeEarned} pts to ${memberNext.name}`}>
                          <span style={{ width: `${Math.min(100, Math.max(4, ((pointsData.lifetimeEarned - memberTier.min) / Math.max(1, memberNext.min - memberTier.min)) * 100))}%` }} />
                        </span>
                      )}
                    </Link>
                  )}
                  {battlepassData && officerTier && (
                    <Link href="/portal?section=battlepass&tab=mine" className={styles.tile} style={{ ['--tile-accent' as string]: officerTier.color }}>
                      <span className={styles.tileTop}><Medal size={15} strokeWidth={1.75} aria-hidden="true" /> Battlepass</span>
                      <span className={styles.tileValue}>{battlepassData.balance.toLocaleString()}<span className={styles.tileUnit}> pts</span></span>
                      <span className={styles.tileTier}>{officerTier.name}</span>
                      {officerNext && (
                        <span className={styles.tileProgress} title={`${officerNext.min - battlepassData.lifetimeEarned} pts to ${officerNext.name}`}>
                          <span style={{ width: `${Math.min(100, Math.max(4, ((battlepassData.lifetimeEarned - officerTier.min) / Math.max(1, officerNext.min - officerTier.min)) * 100))}%` }} />
                        </span>
                      )}
                    </Link>
                  )}
                  {activeTicketCount > 0 && (
                    <Link href="/portal?section=tickets" className={styles.tile} style={{ ['--tile-accent' as string]: '#34d399' }}>
                      <span className={styles.tileTop}><Ticket size={15} strokeWidth={1.75} aria-hidden="true" /> Tickets</span>
                      <span className={styles.tileValue}>{activeTicketCount}<span className={styles.tileUnit}> active</span></span>
                      <span className={styles.tileTier}>Ready to scan</span>
                    </Link>
                  )}
                </div>
              )}
            </header>

            {/* Mobile-only (desktop already has its own persistent search in
                DesktopShell's rail — see PortalHub.tsx — showing both would be
                a duplicate). Sits above the checkin banner and ticket/events
                content, right below the greeting header. */}
            <div className={styles.mobileSearchWrap}>
              <PortalSearch />
            </div>

            </>
          }
          banner={
            <>
            {canHandleHelp && helpWaiting > 0 && (
              <Link href="/portal?section=help&tab=inbox" className={styles.helpBanner}>
                <div className={styles.helpBannerDot} />
                <div>
                  <div className={styles.checkinBannerTitle}>{helpWaiting} help {helpWaiting === 1 ? 'ticket needs' : 'tickets need'} a reply</div>
                  <div className={styles.checkinBannerSub}>Tap to open the inbox</div>
                </div>
                <span className={styles.helpBannerIcon}><LifeBuoy size={24} strokeWidth={1.5} aria-hidden="true" /></span>
              </Link>
            )}
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
            </>
          }
          identity={{ name: profile.display_name || 'Triton', avatarUrl, roleLabel: primaryRoleLabel, roles: roleChips }}
          railFooter={
            <>
              <Link href="/" className={styles.railFooterLink}><span aria-hidden="true"><ArrowLeft size={15} strokeWidth={2} /></span> Back to Site</Link>
              <SignOutButton />
              <Link href="/portal?section=help" className={`${styles.railFooterLink} ${styles.railFooterHelp}`} aria-label={helpWaiting ? `Help (${helpWaiting} waiting)` : 'Help'} title="Help">
                <LifeBuoy size={16} strokeWidth={2} aria-hidden="true" />
                <b>{canHandleHelp ? 'Help inbox' : 'Help & questions'}</b>
                {helpWaiting > 0 && <span className={styles.railFooterHelpBadge}>{helpWaiting}</span>}
              </Link>
            </>
          }
          ticket={nextTicket ? (nextTicket as Parameters<typeof DashboardClient>[0]['ticket']) : null}
          upcomingEvents={unregisteredUpcomingEvents}
          sections={sections}
        />
      </div>
    </div>
  );
}
