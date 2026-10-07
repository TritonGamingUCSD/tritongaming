import { Suspense } from 'react';
import { roleInk } from '@/lib/portal/roleColors';
import Link from 'next/link';
import Image from 'next/image';
import { Ticket, User, Camera, Calendar, Users, QrCode, Pencil, Shield, BookOpen, Image as ImageIcon, Award, ArrowLeft, CalendarCheck, CalendarDays, LayoutGrid, CircleHelp, CalendarHeart, KeyRound, ShieldAlert, CalendarRange, CalendarClock } from 'lucide-react';
import { getProfile, getUserRoles, getMyPrivateProfile, getUser, getSessionRoles, getViewAs, getViewingUser } from '@/lib/core/auth';
import { ViewAsSwitcher, ViewAsBanner, ViewingUserBanner } from '@/components/portal/ViewAs';
import ProfileIncompleteBanner from '@/components/portal/ProfileIncompleteBanner';
import { createClient } from '@/lib/supabase/server';
import { hasCapability, isVerifiedMember, isRewardsEligible, requiresOrgTitle } from '@/lib/portal/capabilities';
import { resolveAvatarUrl, hasBasicProfileInfo, getMissingProfileFields } from '@/lib/members/profile';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DISPLAY_RANK } from '@/types/database';
import { CONTENT_BLOCKS } from '@/lib/site/content-blocks';
import { PACIFIC_TZ, pacificDaysUntil } from '@/lib/core/timezone';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import { getDivisions, divisionLogoSrc } from '@/lib/members/divisions';
import type { HubSection } from '@/components/portal/PortalHub';
import SignOutButton from '@/components/portal/SignOutButton';
import OnboardingGuide from '@/components/portal/OnboardingGuide';
import DashboardClient from './DashboardClient';
import PortalTopSection from './PortalTopSection';
import PortalSearch from '@/components/portal/PortalSearch';
import { PortalParamsProvider } from '@/components/portal/PortalParamsContext';
import { AdminLazy, AlbumsLazy, DivisionMembersLazy, DivisionsLazy, DocsLazy, EventsLazy, MembersLazy, ShiftsLazy, SiteContentLazy } from './LazySections';
import { getAlbumCount, getDocsSummary, getMemberCount, getTiersCached } from '@/lib/portal/portalCounts';
import { getMyShifts } from '@/lib/shifts/myShifts';
import { DashboardWelcome, DashboardBody, type HomeTool } from './DashboardHome';
import TicketsSectionContent from './tickets/TicketsSectionContent';
import { getTicketsData } from './tickets/getTicketsData';
import ProfileClient from './profile/ProfileClient';
import CheckInSectionContent from './checkin/CheckInSectionContent';
import { getCheckinData } from './checkin/getCheckinData';
import PointsSectionContent from './points/PointsSectionContent';
import { getMyPointsData } from './points/getMyPointsData';
import { getTier, nextTier } from '@/lib/members/tiers';
import QRStudioClient from './qrcode/QRStudioClient';
import MeetingsSectionContent from './meetings/MeetingsSectionContent';
import { createServiceClient } from '@/lib/supabase/admin';
import { fetchLinkedEmails } from '@/lib/members/linkedEmails';
import { loadTodos } from '@/lib/portal/todos';
import TodoCard from './TodoCard';
import StrikeCard from './strikes/StrikeCard';
import StrikesSectionContent from './strikes/StrikesSectionContent';
import QuarterStatusContent from './quarters/QuarterStatusContent';
import InactiveNote from './quarters/InactiveNote';
import { currentQuarter, loadQuarters, quarterName } from '@/lib/members/quarters';
import { isInactiveMember } from '@/lib/meetings/meetingAudience';
import { isTracked, mySummary } from '@/lib/members/strikes';
import HelpSectionContent from './help/HelpSectionContent';
import CalendarSectionContent from './calendar/CalendarSectionContent';
import ProfileNudge from '@/components/portal/ProfileNudge';
import { profileNudge } from '@/lib/members/profileCompleteness';
import InternalEventsSectionContent from './internal-events/InternalEventsSectionContent';
import KeysSectionContent from './keys/KeysSectionContent';
import MyKeys from '@/components/portal/MyKeys';
import { keysByHolder } from '@/lib/storage/storageKeys';
import { meetingHappeningNow } from '@/lib/meetings/meetings';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

interface Props {
  // Next's async searchParams (App Router convention) — lets a link like
  // /portal/points/shop both open a hub section AND land on one
  // of its internal tabs, instead of only ever opening to that section's
  // first tab. `tab` is handed to every multi-tab section unconditionally;
  // each one only honors it if it's actually one of its own tab ids and
  // ignores it otherwise, so there's no coordination needed between
  // sections about which tab names are whose.
  searchParams: Promise<{ tab?: string; subtab?: string; section?: string }>;
}

export default async function PortalDashboard({ searchParams }: Props) {
  const rawParams = await searchParams;
  const { tab: requestedTab, subtab: requestedSubTab, section: requestedSection } = rawParams;
  const serverQuery = new URLSearchParams(Object.entries(rawParams as Record<string, string | string[] | undefined>).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]]))).toString();
  // divisions is fetched unconditionally (cheap, publicly-readable table) —
  // needed to label a division-lead role chip with *which* division below,
  // regardless of whether this user themselves can manage the directory.
  const [profile, roles, divisions, myGender, authUser] = await Promise.all([getProfile(), getUserRoles(), getDivisions(), getMyPrivateProfile(), getUser()]);
  // Every email they can sign in with: the choices for the email on their public officer card.
  const linkedEmails = authUser && requestedSection === 'profile' ? [...new Set([authUser.email, ...((await fetchLinkedEmails(createServiceClient(), [authUser.id])).get(authUser.id) ?? []).map((e) => e.email)].filter((e): e is string => !!e))] : [];
  if (!profile) return null;
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));
  // Admins (their REAL roles) get the "View as" menu.
  const [realRoles, viewAs, viewingUser] = await Promise.all([getSessionRoles(), getViewAs(), getViewingUser()]);
  const canViewAs = realRoles.some((r) => r.role === 'admin') && !viewingUser;
  const canViewAsPerson = realRoles.some((r) => r.role === 'admin') && !viewingUser;

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
  const canViewPhotoAlbums = hasCapability(roles, 'view_photo_albums');
  const canManagePhotoAlbums = hasCapability(roles, 'manage_photo_albums');
  const canManageRewardsShop = hasCapability(roles, 'manage_rewards_shop');
  const canScanRedemptions = hasCapability(roles, 'scan_redemptions');
  const canManagePoints = hasCapability(roles, 'manage_points');
  const canAttendMeetings = hasCapability(roles, 'attend_meetings');
  const canViewAttendanceReports = hasCapability(roles, 'view_attendance_reports');
  const canManageMeetings = hasCapability(roles, 'manage_meetings');   // exec/admin: every meeting + HR export
  const canViewInternalEvents = hasCapability(roles, 'view_internal_events');
  // Storage keys: the team sees where each key is, and which member holds which (little key icons on the members list).
  const canViewKeys = hasCapability(roles, 'view_keys');
  const canManageStrikes = hasCapability(roles, 'manage_strikes');
  const canManageQuarters = hasCapability(roles, 'manage_quarters');
  const keyHolders: Awaited<ReturnType<typeof keysByHolder>> = canViewKeys ? await keysByHolder(createServiceClient()).catch(() => ({})) : {};
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
  const canManageShifts = hasCapability(roles, 'manage_shifts');
  const canSignUpShifts = canManageShifts || hasCapability(roles, 'signup_shifts');
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
  const supabase = await createClient();
  // Only what the dashboard, the card badges and the next sections need loads here. The heavy sections (Events, TG Members, Documentation,
  // Photo Albums, Divisions, Site Content, Admin) fetch their own data the first time they are opened (see lib/portalSectionData.ts).
  const [ticketsData, checkinData, pointsData, memberTiers, memberCount, docsSummary, albumCount, myShifts] =
    await Promise.all([
      getTicketsData(profile.id, roles),
      canCheckin ? getCheckinData() : Promise.resolve(null),
      canUseRewards ? getMyPointsData(profile.id) : Promise.resolve(null),
      getTiersCached(),
      canViewMembers ? getMemberCount().catch(() => 0) : Promise.resolve(0),
      canViewDocs ? getDocsSummary(canManageDocs).catch(() => ({ count: 0, pinned: null })) : Promise.resolve(null),
      canViewPhotoAlbums ? getAlbumCount().catch(() => 0) : Promise.resolve(0),
      canSignUpShifts ? getMyShifts(createServiceClient(), profile.id).catch(() => []) : Promise.resolve([]),
    ]);
  // Who is looking, and as whom: the lazy sections keep their data per view, so a changed "view as" never shows another view's data.
  const scope = `${profile.id}|${viewAs ?? ''}|${viewingUser?.id ?? ''}`;

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
  const memberNext = pointsData ? nextTier(pointsData.lifetimeEarned, memberTiers) : null;

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
      // A ticket for something today or tomorrow is what you'll want in your thumb's reach.
      dockBoost: nextTicket?.event && pacificDaysUntil(nextTicket.event.start_date) <= 1 ? 60 : 0,
      // Suggested on the dashboard only when there is something to do: a ticket for an event within a few days, or an open event they have no ticket for yet.
      homeExclude: !((nextTicket?.event && pacificDaysUntil(nextTicket.event.start_date) <= 3) || unregisteredUpcomingEvents.length > 0),
      group: 'Yours',
      content: <TicketsSectionContent tickets={ticketsData.tickets} upcomingEvents={ticketsData.upcomingEvents} isUcsd={ticketsData.isUcsd} canEarnPoints={ticketsData.canEarnPoints} activity={ticketsData.tickets} />,
    },
    {
      id: 'profile', icon: <User size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Profile', railHidden: true,  // opened from your name at the top of the sidebar
      description: 'Update your info and preferences',
      group: 'Overview' as const,
      content: <ProfileClient profile={profile} privateInfo={myGender} email={authUser?.email ?? null} linkedEmails={linkedEmails} roles={roles} isUcsd={isVerifiedMember(roles)} divisions={divisions} initialTab={requestedTab} />,
    },
    {
      id: 'help', icon: <CircleHelp size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Help', railHidden: true,  // a button in the sidebar footer
      description: canHandleHelp ? 'Answer questions and problems from members' : 'Ask a question or report a problem',
      badge: helpWaiting || undefined,
      // Staff get Help on the bar while members are waiting on a reply.
      dockBoost: canHandleHelp && helpWaiting > 0 ? 45 : 0,
      group: 'Resources',
      content: <HelpSectionContent isStaff={canHandleHelp} userId={profile.id} />,
    },
    ...(canUseRewards && pointsData ? [{
      id: 'points', icon: <Award size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Rewards',
      description: 'Earn points for showing up, spend them on perks',
      // Members of the team have their own work to surface; Rewards is for attendees.
      homeExclude: roles.some((r) => ['recruit', 'officer', 'lead', 'exec', 'admin'].includes(r.role)),
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
    {
      id: 'calendar', icon: <CalendarDays size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Calendar',
      description: 'Events and the meetings you’re invited to',
      group: 'Overview' as const,
      content: <CalendarSectionContent />,
    },
    ...(canViewEvents ? [{
      id: 'events', icon: <Calendar size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Events',
      description: canManageEvents ? 'Create and manage events' : 'Browse upcoming and past events',
      dockBoost: canManageEvents ? 35 : 0,
      group: 'Events' as const,
      content: (
        <EventsLazy
          scope={scope}
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
      // Not suggested on the dashboard unless an event is actually happening today.
      homeExclude: todayEvents.length === 0,
      // No event today: nothing to scan, so it does not take a slot on the phone's bottom bar (it is still in More).
      dockExclude: todayEvents.length === 0,
      group: 'Events' as const,
      content: <CheckInSectionContent events={checkinData.events} canScanRedemptions={canScanRedemptions} initialTab={requestedTab} tiers={memberTiers} />,
    }] : []),
    ...(canAttendMeetings || canViewAttendanceReports ? [{
      id: 'meetings', icon: <CalendarCheck size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Meetings',
      description: !canAttendMeetings ? 'Attendance results' : canManageMeetings ? 'Schedule meetings, run check-in, export attendance' : canHostMeetings ? 'Plan your meetings, run check-in, see results' : 'Check in to meetings and see your history',
      // While a meeting is on (or about to start) this is the thing to have under your thumb.
      dockBoost: (meetingNow ? 100 : 0) + (canManageMeetings ? 10 : 0),
      group: 'Team' as const,
      content: <MeetingsSectionContent canHost={canHostMeetings} canManageAll={canManageMeetings} userId={profile.id} canAttend={canAttendMeetings} canViewReports={canViewAttendanceReports} />,
    }] : []),
    // Officers and leads sign up for a station and time at an event; exec set the grids up. See lib/shifts.ts.
    ...(canSignUpShifts ? [{
      id: 'shifts', icon: <CalendarClock size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Shifts',
      description: 'Sign up for a station and time at an event',
      group: 'Events' as const,
      content: <ShiftsLazy scope={scope} canManage={canManageShifts} canSignUp={canSignUpShifts} userId={profile.id} userName={profile.display_name || 'Someone'} />,
    }] : []),
    // Exec, HR and admins get the tracker. Nobody else (leads included) has any part in it.
    ...(canManageStrikes ? [{
      id: 'strikes', icon: <ShieldAlert size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Strikes',
      description: 'Private strike tracker',
      group: 'Team' as const,
      content: <StrikesSectionContent />,
    }] : []),
    // Exec and admins mark officers and leads inactive for a quarter (admins also set the quarter dates, inside the same page).
    ...(canManageQuarters ? [{
      id: 'quarters', icon: <CalendarRange size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Quarter status',
      description: 'Who is active each quarter',
      group: 'Team' as const,
      content: <QuarterStatusContent />,
    }] : []),
    ...(canViewKeys ? [{
      id: 'keys', icon: <KeyRound size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Storage Keys',
      description: 'Where each storage key is right now',
      badge: (keyHolders[profile.id]?.length ?? 0) || undefined,
      group: 'Team' as const,
      content: <KeysSectionContent />,
    }] : []),
    ...(canViewInternalEvents ? [{
      id: 'internal-events', icon: <CalendarHeart size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Internal Events',
      description: canHostInternalEvents ? 'Plan internal events and see who’s coming' : 'Socials, trainings and other internal events',
      group: 'Events' as const,
      content: <InternalEventsSectionContent canHost={canHostInternalEvents} canRsvp={!isInactiveMember(roles)} />,
    }] : []),
    ...(canViewMembers ? [{
      id: 'members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'TG Members',
      description: 'Browse everyone in the org',
      // Not rows.length — that counts every profile including plain
      // verified-student accounts who never joined anything, which the
      // Members page itself excludes. This badge would otherwise promise a
      // much bigger roster than the page actually shows.
      badge: memberCount || undefined,
      homeExclude: true, dockExclude: true,
      group: 'Team' as const,
      content: <MembersLazy scope={scope} keysByUser={keyHolders} canViewAsPerson={canViewAsPerson} selfId={profile.id} canOrder={hasCapability(roles, 'manage_board_order')} teams={canHostMeetings || canManageMeetings ? { userId: profile.id, canManageAll: canManageMeetings, canEdit: true } : roles.some((r) => r.role === 'officer') ? { userId: profile.id, canManageAll: false, canEdit: false } : undefined} />,
    }] : []),
    ...(canViewDocs && docsSummary ? [{
      id: 'docs', icon: <BookOpen size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Documentation',
      homeExclude: true, dockExclude: true,
      group: 'Resources' as const,
      description: 'How-to guides for officers, leads, and execs',
      badge: docsSummary.count || undefined,
      content: <DocsLazy scope={scope} userId={profile.id} canEdit={canManageDocs} />,
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
    ...(canViewPhotoAlbums ? [{
      id: 'albums', icon: <ImageIcon size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Photo Albums',
      description: 'Google Photos albums from past events',
      badge: albumCount || undefined,
      group: 'Resources' as const,
      content: <AlbumsLazy scope={scope} canManage={canManagePhotoAlbums} />,
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
      group: 'Team' as const,
      content: (
        <DivisionsLazy
          scope={scope}
          canManageDivisions={canManageDivisions}
          isDivisionLead={isDivisionLead}
        />
      ),
    }] : []),
    ...(canSeeDivisionMembers ? [{
      id: 'division-members', icon: <Users size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Division Members',
      description: 'Who leads each division',
      group: 'Team' as const,
      content: <DivisionMembersLazy scope={scope} />,
    }] : []),
    ...(canEditContent ? [{
      id: 'site-content', icon: <Pencil size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Site Content',
      description: 'Page banners, text and images on the public site',
      group: 'Admin' as const,
      content: (
        <SiteContentLazy
          scope={scope}
          canEditContent={canEditContent}
          contentBlocks={CONTENT_BLOCKS}
        />
      ),
    }] : []),
    ...(canViewAdmin ? [{
      id: 'admin', icon: <Shield size={28} strokeWidth={1.5} aria-hidden="true" />, label: 'Admin',
      description: 'Stats, roles, analytics, and audit history',
      group: 'Admin' as const,
      content: (
        <AdminLazy
          scope={scope}
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

  // The points tiles and the "View as" menu, as pieces: the phone header shows them in the greeting card, the desktop app frame puts
  // View as in its top bar and the tiles at the top of the Dashboard.
  // The points tile on the home screen is the member Rewards tile, shown to anyone who can use Rewards.
  // The team (recruit and up) gets the work-oriented home; students and guests get the attendee home.
  const isTeamMember = roles.some((r) => ['recruit', 'officer', 'lead', 'exec', 'admin'].includes(r.role));
  const showRewardsTile = !!pointsData && !!memberTier;
  const tilesNode = showRewardsTile ? (
                <div className={styles.tiles}>
                  {showRewardsTile && pointsData && memberTier && (
                    <Link href="/portal/points/mine" className={styles.tile} style={{ ['--tile-accent' as string]: memberTier.color }}>
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
                </div>
  ) : null;
  const nudge = profileNudge(profile, myGender, heldRoles);
  // The same reminders the layout shows above the page; on desktop they sit inside the app frame instead.
  const missingProfileFields = getMissingProfileFields({ ...profile, gender: myGender.gender }, isVerifiedMember(roles), { requireOrgTitle: requiresOrgTitle(roles) });
  const missingOnlyOfficerTab = missingProfileFields.length > 0 && getMissingProfileFields({ ...profile, gender: myGender.gender }, isVerifiedMember(roles)).length === 0;
  const frameBanners = (
    <>
      {viewAs && <ViewAsBanner active={viewAs} />}
      {viewingUser && <ViewingUserBanner name={profile.display_name || profile.google_first_name || 'this person'} />}
      <Suspense fallback={null}><ProfileIncompleteBanner missing={missingProfileFields} officerTabOnly={missingOnlyOfficerTab} /></Suspense>
    </>
  );
  const viewAsNode = canViewAs ? <ViewAsSwitcher active={viewAs} /> : null;
  // Everything waiting on this person, together at the top of home: plans to answer, events to RSVP to, help replies, check-in today.
  // My own strikes (officers, leads and exec only): private, shown only to me.
  // Sitting the quarter out: a quiet note saying so.
  const inactiveQuarter = isInactiveMember(roles) ? await loadQuarters(createServiceClient()).then((qs) => currentQuarter(qs)).catch(() => null) : null;
  const myStrikes = isTracked(roles) ? await mySummary(createServiceClient(), profile.id).catch(() => null) : null;
  const todoItems = await loadTodos(createServiceClient(), { id: profile.id, roles }, { manageAll: canManageMeetings, canHost: canHostMeetings, canViewInternalEvents: canViewInternalEvents && !isInactiveMember(roles) });   // inactive people can't answer events, so there's nothing to RSVP to
  if (canHandleHelp && helpWaiting > 0) todoItems.push({ id: 'help-inbox', text: `${helpWaiting} help ${helpWaiting === 1 ? 'ticket needs' : 'tickets need'} a reply`, detail: 'Open the help inbox', href: '/portal/help/inbox', tone: 'urgent' });
  else if (!canHandleHelp && helpWaiting > 0) todoItems.push({ id: 'help-reply', text: helpWaiting === 1 ? 'You have a reply to your question' : `You have ${helpWaiting} replies to your questions`, href: '/portal/help', tone: 'normal' });
  if (canCheckin && todayEvents.length > 0) todoItems.push({ id: 'checkin-today', text: `Event today: ${todayEvents[0].title}`, detail: 'Open the check-in scanner', href: '/portal/checkin', tone: 'urgent' });
  if (meetingNow) todoItems.push({ id: 'meeting-now', text: 'A meeting is on now', detail: 'Check in with the code from the room', href: '/portal/meetings/mine', tone: 'urgent' });
  const greetingLine = `${greeting}, ${profile.display_name?.split(' ')[0] || 'Triton'}`;

  // The redesigned dashboard's pieces: the quarter in the eyebrow, the next event as a ticket, a pinned doc as the note,
  // tools split into paper (every member) and glass (team), and the latest ticket activity.
  const termNow = (() => { const m = Number(new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, month: 'numeric' }).format(new Date())); const y = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, year: 'numeric' }).format(new Date()); return `${m >= 9 || m === 1 ? (m === 1 ? 'Winter' : 'Fall') : m <= 3 ? 'Winter' : m <= 6 ? 'Spring' : 'Summer'} ${y}`; })();
  const homeEyebrow = `${termNow} · Home`;
  const ticketEvent = nextTicket?.event ?? null;
  const featured = ticketEvent ?? unregisteredUpcomingEvents[0] ?? null;
  const homeEvent = featured ? { id: featured.id, title: featured.title, start_date: featured.start_date, location: featured.location, hasTicket: !!ticketEvent, ticketId: nextTicket?.id } : null;
  const pinnedDoc = docsSummary?.pinned ?? null;
  const homeNote = pinnedDoc ? { title: pinnedDoc.title, href: `/portal/docs?id=${pinnedDoc.id}` } : null;
  const EVERYONE_TOOLS = ['tickets', 'points', 'calendar', 'profile'];
  const homeTools: HomeTool[] = [
    ...EVERYONE_TOOLS.map((id) => sections.find((x) => x.id === id)).filter((x): x is HubSection => !!x).map((x) => ({ id: x.id, label: x.label, hint: x.description, href: `/portal/${x.id}`, tier: 'everyone' as const })),
    ...sections.filter((x) => !EVERYONE_TOOLS.includes(x.id) && !x.homeExclude && ['Events', 'Team', 'Admin', 'Resources'].includes(x.group)).slice(0, 8).map((x) => ({ id: x.id, label: x.label, hint: x.description, href: `/portal/${x.id}`, tier: 'officer' as const })),
  ];
  const homeActivity = ticketsData.tickets
    .flatMap((t) => (t.event ? [{ key: `${t.id}-r`, text: 'Got a ticket', detail: t.event.title, at: t.created_at }, ...(t.checked_in_at ? [{ key: `${t.id}-c`, text: 'Checked in', detail: t.event.title, at: t.checked_in_at }] : [])] : []))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5);

  return (
    <PortalParamsProvider query={serverQuery}>
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
          welcome={<DashboardWelcome eyebrow={homeEyebrow} name={profile.display_name?.split(' ')[0] || 'Triton'} />}
          body={<DashboardBody shifts={myShifts} event={homeEvent} note={homeNote} tools={homeTools} activity={homeActivity} showRoleAsk={!isTeamMember} />}
          desktop={{ greeting: greetingLine, tiles: tilesNode, viewAs: viewAsNode, banners: frameBanners }}
          top={
            <>
            <header className={styles.welcome}>
              <Image src="/bytes/byte_tgex25.png" alt="" width={723} height={723} aria-hidden="true" className={styles.welcomeMascot} />
              <div className={styles.welcomeMain}>
                <Link href="/portal/profile" className={styles.welcomeAvatarLink} aria-label="Open your profile">
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
                      <span className={styles.roleChip} style={{ background: ROLE_COLORS.guest + '18', color: roleInk(ROLE_COLORS.guest), borderColor: ROLE_COLORS.guest + '44' }}>
                        {ROLE_LABELS.guest}
                      </span>
                    ) : (
                      [...heldRoles].sort((a, b) => ROLE_DISPLAY_RANK[b.role] - ROLE_DISPLAY_RANK[a.role]).map((r) => (
                        <span
                          key={`${r.role}-${r.division_id ?? ''}`}
                          className={styles.roleChip}
                          style={{ background: ROLE_COLORS[r.role] + '18', color: roleInk(ROLE_COLORS[r.role]), borderColor: ROLE_COLORS[r.role] + '44' }}
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
                    <Link href="/" className={styles.headerActionLink}>← Back to site</Link>
                    <span className={styles.headerActionDivider} aria-hidden="true">·</span>
                    <SignOutButton />
                  </div>
                </div>
              </div>

              {viewAsNode && <div className={styles.viewAsSlot}>{viewAsNode}</div>}

              {/* Mobile only: search lives inside the header card (desktop has it in the pinned header). */}
          <div className={styles.welcomeSearch}><PortalSearch compact /></div>

          {/* At-a-glance stats — each tile deep-links to that section's own tab. */}
              {tilesNode}
            </header>

            {/* Mobile-only (desktop already has its own persistent search in
                DesktopShell's rail — see PortalHub.tsx — showing both would be
                a duplicate). Sits above the checkin banner and ticket/events
                content, right below the greeting header. */}
            <div className={styles.mobileSearchWrap}>
              <PortalSearch large />
            </div>

            </>
          }
          banner={
            <>
            <TodoCard items={todoItems} />
            {isInactiveMember(roles) && <InactiveNote quarter={inactiveQuarter ? quarterName(inactiveQuarter) : null} />}
            {myStrikes && <StrikeCard active={myStrikes.active} limit={myStrikes.limit} />}
            <MyKeys keys={keyHolders[profile.id] ?? []} />
            {nudge.missing.length > 0 && hasBasicProfileInfo({ ...profile, gender: myGender.gender }, isVerifiedMember(roles)) && <ProfileNudge nudge={nudge} />}
            </>
          }
          identity={{ name: profile.display_name || 'Triton', avatarUrl, roleLabel: primaryRoleLabel, roles: roleChips }}
          railFooter={
            <>
              <Link href="/" className={styles.railFooterLink}><span aria-hidden="true"><ArrowLeft size={15} strokeWidth={2} /></span> Back to Site</Link>
              <SignOutButton />
              <Link href="/portal/help" className={`${styles.railFooterLink} ${styles.railFooterHelp}`} title={canHandleHelp ? 'Help inbox' : 'Help & questions'}>
                <CircleHelp size={16} strokeWidth={2} aria-hidden="true" />
                <b>{canHandleHelp ? 'Help inbox' : 'Help & questions'}</b>
                {helpWaiting > 0 && <span className={styles.railFooterHelpBadge}>{helpWaiting}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}> waiting</span></span>}
              </Link>
            </>
          }
          ticket={nextTicket ? (nextTicket as Parameters<typeof DashboardClient>[0]['ticket']) : null}
          upcomingEvents={unregisteredUpcomingEvents}
          sections={sections}
        />
      </div>
    </div>
    </PortalParamsProvider>
  );
}
