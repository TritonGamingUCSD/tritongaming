// Broadcast: who may use it, the roles on a show, and the go-live checklist. Plain data, shared by the screens and the routes.
export const BROADCAST_ADMIN_ONLY = true; // admin-only for now, like Tournaments; turn off to give it to a broadcast team

export const BROADCAST_ROLES = ['Producer', 'Play-by-play caster', 'Color caster', 'Host', 'Board operator', 'Camera', 'Observer', 'Replay', 'Chat moderator'] as const;

export interface CheckStep {
  id: string;
  label: string;
  hint?: string;
}
export const CHECKLIST: { phase: string; steps: CheckStep[] }[] = [
  {
    phase: 'Before (a day ahead)',
    steps: [
      { id: 'roles', label: 'Everyone has a role', hint: 'Producer, casters, board operator, camera.' },
      { id: 'title', label: 'Stream title, game and tags are set on Twitch and YouTube' },
      { id: 'overlays', label: 'OBS scenes imported from the tournament’s Stream tab', hint: 'Tournament → Stream → Download OBS Scenes.' },
      { id: 'assets', label: 'Sponsor graphics, starting screen and BRB scene are ready' },
    ],
  },
  {
    phase: 'Setup (an hour ahead)',
    steps: [
      { id: 'audio', label: 'Mics, game audio and music levels checked' },
      { id: 'sources', label: 'Overlays load (scoreboard and up next show data)', hint: 'Open the tournament’s Control tab and mark a match live.' },
      { id: 'test', label: 'A private test stream looks and sounds right' },
      { id: 'comms', label: 'Team chat and the player call are open' },
    ],
  },
  {
    phase: 'Live',
    steps: [
      { id: 'live', label: 'Go live on Twitch and YouTube, then mark this broadcast Live here' },
      { id: 'social', label: 'Announce in Discord and social media' },
    ],
  },
  {
    phase: 'After',
    steps: [
      { id: 'vod', label: 'Stream ended, VOD saved' },
      { id: 'clips', label: 'Highlights picked and posted' },
      { id: 'recap', label: 'Results posted and the VOD link added here' },
    ],
  },
];
export const ALL_STEPS = CHECKLIST.flatMap((p) => p.steps.map((s) => s.id));

export const CHANNEL_KEYS = { twitch: 'broadcast_twitch', youtube: 'broadcast_youtube' } as const;
/** The settings keys holding the channels of the club (no division) or of one division. */
export const channelKeys = (divisionId?: string | null) =>
  divisionId ? { twitch: `${CHANNEL_KEYS.twitch}:${divisionId}`, youtube: `${CHANNEL_KEYS.youtube}:${divisionId}` } : CHANNEL_KEYS;

/** A Twitch channel name from what someone typed ("twitch.tv/tritongaming" works), or '' if it is not one. */
export function cleanTwitch(raw: string): string {
  const m = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];
  return /^[A-Za-z0-9_]{3,25}$/.test(m) ? m.toLowerCase() : '';
}
/** A YouTube channel id ("UC…", 24 characters) from an id or a /channel/ link, or ''. @handles need an id, so they are refused with a plain message by the route. */
export function cleanYoutube(raw: string): string {
  const m = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?youtube\.com\/channel\//i, '')
    .split(/[/?#]/)[0];
  return /^UC[A-Za-z0-9_-]{22}$/.test(m) ? m : '';
}
