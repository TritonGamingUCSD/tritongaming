// Admin on/off switches for features (Admin → Settings → Feature Switches). Every switch is ON unless an admin turns it off; an off switch is stored as `sw_<key>` = 'off' in team_settings.
// Plain data and pure functions, so the screen, the server routes and the tests all read the same list.
export interface FeatureSwitch {
  key: string;
  group: 'club' | 'divisions';
  label: string;
  /** What turning it off does, in a sentence. */
  off: string;
}

export const FEATURE_SWITCHES: readonly FeatureSwitch[] = [
  { key: 'trivia', group: 'club', label: 'Trivia', off: 'Hides Trivia for the club and divisions and stops new games and joining.' },
  { key: 'polls', group: 'club', label: 'Polls', off: 'Hides Polls and stops new polls and voting.' },
  { key: 'qa', group: 'club', label: 'Q&A', off: 'Hides Q&A and stops new sessions and questions.' },
  { key: 'photobooth', group: 'club', label: 'Photo Booth', off: 'Hides the Photo Booth and stops new sessions.' },
  { key: 'rewards', group: 'club', label: 'Rewards and Points Shop', off: 'Hides rewards and stops redeeming points. Points still count.' },
  { key: 'self_checkin', group: 'club', label: 'Self and Online Check-In', off: 'Members cannot check themselves in; staff scanning still works.' },
  { key: 'tickets', group: 'club', label: 'Ticket Sign-Ups', off: 'Nobody can get new tickets (a freeze); existing tickets still work.' },
  { key: 'newsletter', group: 'club', label: 'Newsletter Sending', off: 'The newsletter can be written but not sent.' },
  { key: 'logistics', group: 'club', label: 'Logistics Requests', off: 'Hides devices and prizes requests and stops new ones.' },
  { key: 'meetings', group: 'club', label: 'Meetings and Meeting Check-In', off: 'Hides meetings and stops new check-ins to them.' },
  { key: 'public_media', group: 'club', label: 'Public Media Page', off: 'The media page on the public site shows nothing and is left out of the sitemap.' },
  { key: 'public_sponsors', group: 'club', label: 'Public Sponsors Page', off: 'The sponsors page on the public site shows nothing and is left out of the sitemap.' },
  { key: 'tournaments', group: 'club', label: 'Tournaments', off: 'Hides tournaments and their public pages and stream overlays, and stops new ones and score entry.' },
  { key: 'broadcast', group: 'club', label: 'Broadcast', off: 'Hides the Broadcast section and the public watch page.' },
  { key: 'word_filter', group: 'club', label: 'Word Filter', off: 'Blocked words are no longer refused when something is saved.' },
  { key: 'div_join', group: 'divisions', label: 'Join Requests', off: 'Students cannot ask to join any division.' },
  { key: 'div_public_docs', group: 'divisions', label: 'Public Guides', off: 'Public docs stop showing on division pages.' },
  { key: 'div_cohost', group: 'divisions', label: 'Co-Hosting', off: 'Divisions cannot invite other divisions to co-host.' },
  { key: 'div_live', group: 'divisions', label: 'Live Tools For Divisions', off: 'Hides Trivia, Polls, Q&A and Photo Booth on division pages and blocks them.' },
  { key: 'div_tournaments', group: 'divisions', label: 'Tournaments For Divisions', off: 'Divisions cannot create or run tournaments, and theirs are hidden.' },
  { key: 'div_announce_notify', group: 'divisions', label: 'Announcement Notifications', off: 'Announcements still post on Home but send no notifications.' },
  { key: 'div_public_pages', group: 'divisions', label: 'Division Public Pages', off: 'Every division page, its sub pages and its Team and Events cards are hidden.' },
  { key: 'div_club_events', group: 'divisions', label: 'Club Events On Division Pages', off: 'The “Also at Triton Gaming” band is left out.' },
];

export const switchKey = (key: string) => `sw_${key}`;
export const SWITCH_DB_KEYS: readonly string[] = FEATURE_SWITCHES.map((s) => switchKey(s.key));
export const isSwitchKey = (key: unknown): key is string => typeof key === 'string' && FEATURE_SWITCHES.some((s) => s.key === key);

/** The keys of the switches that are off, from the rows of team_settings. */
export function parseOff(rows: { key: string; value: string }[] | null | undefined): string[] {
  const off = new Set((rows ?? []).filter((r) => r.value === 'off').map((r) => r.key));
  return FEATURE_SWITCHES.filter((s) => off.has(switchKey(s.key))).map((s) => s.key);
}

/** Whether a feature is on. */
export const featureOn = (settings: { off: string[] }, key: string): boolean => !settings.off.includes(key);
