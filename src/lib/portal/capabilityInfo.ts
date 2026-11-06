import type { Capability } from '@/types/database';

// A plain-language catalog of every permission: what it is called, what area it belongs to, what it lets someone do, and whether the app or the database enforces it.
// 'app' permissions are checked by the portal's own screens and routes, so an access rule (give or take away) changes them. 'db' permissions are also checked by the database's own rules for the tables behind them, so they follow roles only; they are shown but cannot be given or taken away person by person.
export type CapArea = 'Events' | 'Check-in and rewards' | 'Meetings and standing' | 'Logistics' | 'Content' | 'Live tools' | 'Divisions' | 'Tournaments and broadcast' | 'Admin';
export interface CapInfo {
  label: string;
  area: CapArea;
  about: string;
  enforced: 'app' | 'db';
}

export const CAPABILITY_INFO: Record<Capability, CapInfo> = {
  view_events: { label: 'See events', area: 'Events', about: 'Open the events list and reports.', enforced: 'db' },
  manage_events: { label: 'Create and edit events', area: 'Events', about: 'Make, edit and publish events.', enforced: 'db' },
  delete_events: { label: 'Delete events', area: 'Events', about: 'Remove an event for good.', enforced: 'db' },
  checkin: { label: 'Run check-in', area: 'Check-in and rewards', about: 'Scan tickets and check people in.', enforced: 'db' },
  scan_redemptions: { label: 'Hand over rewards', area: 'Check-in and rewards', about: 'Scan a redemption code and confirm a reward was handed over.', enforced: 'app' },
  manage_points: { label: 'Fix points', area: 'Check-in and rewards', about: 'Reverse a check-in or redemption, or adjust points by hand.', enforced: 'app' },
  manage_rewards_shop: { label: 'Rewards shop', area: 'Check-in and rewards', about: 'Create, edit and retire shop items.', enforced: 'app' },
  generate_qr_codes: { label: 'QR Studio', area: 'Content', about: 'Make QR codes.', enforced: 'app' },
  attend_meetings: { label: 'Attend meetings', area: 'Meetings and standing', about: 'Check in to the weekly meeting.', enforced: 'app' },
  host_meetings: { label: 'Plan meetings', area: 'Meetings and standing', about: 'Create meetings and run the ones you planned.', enforced: 'app' },
  manage_meetings: { label: 'Run every meeting', area: 'Meetings and standing', about: 'Open check-in, show the code, and edit any meeting.', enforced: 'app' },
  view_attendance_reports: { label: 'Attendance reports', area: 'Meetings and standing', about: 'See everyone’s meeting attendance and absences (view only).', enforced: 'app' },
  manage_strikes: { label: 'Strikes (HR)', area: 'Meetings and standing', about: 'See and manage every strike and voucher. Very private.', enforced: 'app' },
  manage_quarters: { label: 'Quarter status', area: 'Meetings and standing', about: 'Mark officers and leads inactive for a quarter.', enforced: 'app' },
  manage_help: { label: 'Answer help tickets', area: 'Meetings and standing', about: 'See every help ticket and reply.', enforced: 'app' },
  view_logistics: { label: 'See logistics', area: 'Logistics', about: 'Look at equipment, prizes and event plans.', enforced: 'app' },
  request_logistics: { label: 'Request logistics', area: 'Logistics', about: 'Send a request for gear or prizes.', enforced: 'app' },
  manage_logistics: { label: 'Manage logistics', area: 'Logistics', about: 'Change equipment, prizes, sponsors and event plans.', enforced: 'app' },
  view_docs: { label: 'Read documentation', area: 'Content', about: 'Open the documentation pages.', enforced: 'db' },
  manage_docs: { label: 'Write documentation', area: 'Content', about: 'Create, edit and delete documentation.', enforced: 'db' },
  write_newsletter: { label: 'Write the newsletter', area: 'Content', about: 'Write issues and ask for them to be checked.', enforced: 'app' },
  send_newsletter: { label: 'Send the newsletter', area: 'Content', about: 'Approve and send an issue; see subscribers.', enforced: 'app' },
  manage_site_content: { label: 'Edit site content', area: 'Content', about: 'Change the public website’s pages.', enforced: 'db' },
  manage_board_order: { label: 'Team page order', area: 'Content', about: 'Change the order people appear on the Team page.', enforced: 'app' },
  host_trivia: { label: 'Trivia', area: 'Live tools', about: 'Write quizzes and host games.', enforced: 'app' },
  run_photobooth: { label: 'Photo Booth', area: 'Live tools', about: 'Set up and run the booth.', enforced: 'app' },
  view_members: { label: 'See TG Members', area: 'Divisions', about: 'Open the member roster.', enforced: 'db' },
  view_division_members: { label: 'See Division Heads', area: 'Divisions', about: 'Open the Division Heads directory.', enforced: 'app' },
  manage_division: { label: 'Edit own division', area: 'Divisions', about: 'Edit a division the person leads.', enforced: 'db' },
  manage_divisions_directory: { label: 'Manage all divisions', area: 'Divisions', about: 'Add, edit and remove any division.', enforced: 'db' },
  manage_tournaments: { label: 'Manage tournaments', area: 'Tournaments and broadcast', about: 'Create tournaments, set structure and entrants, start them.', enforced: 'app' },
  run_tournaments: { label: 'Run tournaments', area: 'Tournaments and broadcast', about: 'Enter scores, call stations, use the Control panel.', enforced: 'app' },
  manage_broadcast: { label: 'Broadcast', area: 'Tournaments and broadcast', about: 'Schedule streams, roles, checklist and channels.', enforced: 'app' },
  manage_word_filter: { label: 'Word filter', area: 'Admin', about: 'Change the blocked and allowed words.', enforced: 'app' },
  view_admin_dashboard: { label: 'Admin dashboard', area: 'Admin', about: 'Open the Admin section.', enforced: 'db' },
  manage_roles: { label: 'Roles and settings', area: 'Admin', about: 'Give roles and change site settings.', enforced: 'db' },
};

export const CAP_AREAS: CapArea[] = [
  'Events',
  'Check-in and rewards',
  'Meetings and standing',
  'Logistics',
  'Content',
  'Live tools',
  'Divisions',
  'Tournaments and broadcast',
  'Admin',
];
/** The permissions an access rule may give or take away. */
export const RULE_CAPABILITIES = (Object.keys(CAPABILITY_INFO) as Capability[]).filter((c) => CAPABILITY_INFO[c].enforced === 'app');
