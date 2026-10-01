import type { Profile, AppRole } from '@/types/database';

// A profile counts as an org member for the portal's Members roster if it
// holds any role besides the auto-granted 'ucsd' verified-student badge —
// a bare 'ucsd' (or zero roles at all) means "verified/logged-in visitor,"
// not someone who's actually joined anything. Lives here (not
// getMembersData.ts, which pulls in the server-only Supabase client) so
// the client-side MembersSectionContent can share it with the server-side
// getMembersData without dragging next/headers into the client bundle.
// Division leads aren't TG members on their own either: a person whose only roles are ucsd and/or
// division doesn't count (someone who is also an officer, lead, exec, etc. still does).
export function isOrgMember(userRoles: Array<{ role: AppRole }> | null | undefined): boolean {
  return (userRoles ?? []).some((r) => r.role !== 'ucsd' && r.role !== 'division');
}

// ── Class year ───────────────────────────────────────────────────────────────
// People give their graduation year ("Class of ‘28"); "3rd Year" is derived from
// it, so it rolls forward on its own every September (the database keeps
// profiles.year in step — see 20261002030000_class_of_year.sql). These mirror
// the SQL functions of the same names. The academic year runs from September.
export function academicYearEnd(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return year + (month >= 9 ? 1 : 0);
}

export function classOfToYear(classOf: number, now: Date = new Date()): string {
  const end = academicYearEnd(now);
  if (classOf < end) return 'Alumni';
  const ahead = classOf - end;
  return ahead >= 3 ? '1st Year' : ahead === 2 ? '2nd Year' : ahead === 1 ? '3rd Year' : '4th Year';
}

// "Class of ‘28" — same wording (curly quote) as UCSD's AS Form uses.
export const classLabel = (classOf: number) => `Class of ‘${String(classOf % 100).padStart(2, '0')}`;

// The choices for the profile's year field: the classes currently enrolled
// (plus next fall's incoming class over the summer), then Graduate / Alumni.
// Values are the graduation year as a string, or 'Graduate' / 'Alumni'.
export function yearChoiceOptions(now: Date = new Date()): Array<{ value: string; label: string }> {
  const end = academicYearEnd(now);
  const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric' }).format(now));
  const classes: number[] = [];
  for (let c = end; c <= end + 3; c++) classes.push(c);
  if (month < 9) classes.push(end + 4); // incoming freshmen, before fall quarter
  return [
    ...classes.map((c) => ({ value: String(c), label: `${classLabel(c)} · ${classOfToYear(c, now)}` })),
    { value: 'Graduate', label: 'Graduate student' },
    { value: 'Alumni', label: 'Alumni' },
  ];
}

// The select's value for a saved profile.
export function yearChoiceOf(profile: { class_of?: number | null; year?: string | null }): string {
  if (profile.class_of) return String(profile.class_of);
  const y = profile.year?.trim() ?? '';
  return y === 'Graduate' || y === 'Alumni' ? y : '';
}

// The "3rd Year"-style label for a select value (what's shown on cards/exports).
export function yearLabelOfChoice(choice: string, now: Date = new Date()): string {
  const n = Number(choice);
  return Number.isFinite(n) && n > 1900 ? classOfToYear(n, now) : choice;
}

// Gender is stored apart from the public profile row (see profile_private) —
// these are the allowed values. "Prefer not to say" counts as answered.
export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'] as const;

type ProfileInfo = Pick<Profile, 'display_name' | 'major' | 'year' | 'college' | 'pronouns'> & { gender?: string | null; org_title?: string | null };

// The required profile fields still blank, as labels. Name, gender and
// pronouns are required for everyone; year, college and major only for verified UCSD
// members (isUcsd — see isVerifiedMember in lib/capabilities.ts), since a
// non-UCSD guest has none of those to give.
// `requireOrgTitle` is for people who hold an org position (officer, lead, exec,
// division lead — see canSetOrgTitle): their title appears on the public
// officer card, so it isn't optional for them. It's deliberately not part of
// hasBasicProfileInfo — a missing title shouldn't block claiming a ticket.
export function getMissingProfileFields(profile: ProfileInfo, isUcsd: boolean, opts: { requireOrgTitle?: boolean } = {}): string[] {
  const missing: string[] = [];
  if (!profile.display_name?.trim()) missing.push('Name');
  if (isUcsd) {
    if (!profile.year?.trim()) missing.push('Year');
    if (!profile.college?.trim()) missing.push('College');
    if (!profile.major?.trim()) missing.push('Major');
  }
  if (!profile.gender?.trim()) missing.push('Gender');
  if (!profile.pronouns?.trim()) missing.push('Pronouns');
  if (opts.requireOrgTitle && !profile.org_title?.trim()) missing.push('Officer title');
  return missing;
}

// "Basic info" required before someone can claim a ticket — tied to their
// account, so once it's filled in they're never asked again. Gamer tag,
// pronouns and bio are intentionally never required.
export function hasBasicProfileInfo(profile: ProfileInfo, isUcsd: boolean): boolean {
  return getMissingProfileFields(profile, isUcsd).length === 0;
}

// Leaderboard "anonymous" display — masks the first name instead of a
// generic "Anonymous" placeholder, so the board still reads as a list of
// people rather than a wall of identical labels. Shows up to the first 3
// characters of the first name (fewer if it's shorter) followed by '***';
// falls back to a fixed placeholder when there's no name to mask at all.
export function maskDisplayName(displayName: string | null): string {
  const firstName = displayName?.trim().split(/\s+/)[0];
  if (!firstName) return 'A member';
  return `${firstName.slice(0, 3)}***`;
}

// avatar_url is never touched by the custom-picture feature — it stays
// exactly what Google sync last set it to. custom_avatar_url, when set,
// wins everywhere a profile picture is displayed; an empty/unset value
// falls back to avatar_url automatically.
export function resolveAvatarUrl(profile: { avatar_url: string | null; custom_avatar_url?: string | null }): string | null {
  return profile.custom_avatar_url?.trim() || profile.avatar_url;
}

// Platforms a member can optionally link from their profile — reuses the
// same brand SVGs the footer already renders (public/logos), so a social
// icon looks identical whether it's site chrome or a member's own link.
// Stored value is just the handle/username (not a full URL) — simpler to
// type and to edit later; socialHref() below builds the real link. Discord
// has no urlPrefix since it has no public profile URL from a bare
// username — it renders as a plain (non-linked) icon+handle instead.
export interface SocialPlatform {
  key: string;
  label: string;
  logo: string;
  placeholder: string;
  urlPrefix?: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'discord',   label: 'Discord', logo: '/logos/discord.svg', placeholder: 'username or name#1234' },
  { key: 'instagram', label: 'Instagram', logo: '/logos/instagram.svg', placeholder: 'yourhandle', urlPrefix: 'https://instagram.com/' },
  { key: 'twitter',   label: 'X (Twitter)', logo: '/logos/x.svg', placeholder: 'yourhandle', urlPrefix: 'https://x.com/' },
  { key: 'tiktok',    label: 'TikTok', logo: '/logos/tiktok.svg', placeholder: 'yourhandle', urlPrefix: 'https://tiktok.com/@' },
  { key: 'twitch',    label: 'Twitch', logo: '/logos/twitch.svg', placeholder: 'yourhandle', urlPrefix: 'https://twitch.tv/' },
  { key: 'youtube',   label: 'YouTube', logo: '/logos/youtube.svg', placeholder: 'yourhandle', urlPrefix: 'https://youtube.com/@' },
  { key: 'linkedin',  label: 'LinkedIn', logo: '/logos/linkedin.svg', placeholder: 'yourhandle', urlPrefix: 'https://linkedin.com/in/' },
];

// null means "not a clickable link" (Discord) — render as plain text/icon.
export function socialHref(platform: SocialPlatform, value: string): string | null {
  if (!platform.urlPrefix) return null;
  return platform.urlPrefix + value.trim().replace(/^@/, '');
}

// Pronoun choices for the profile dropdown. Anything not in this list is a
// custom "Other" entry, stored as the text the person typed.
export const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Any pronouns', 'Prefer not to say'] as const;

// Optional "what do you play" answers (stored privately, for club analytics).
export const PLATFORM_OPTIONS = ['PC', 'Console', 'Mobile', 'Tabletop'] as const;

// A link on someone's officer card (portfolio, GitHub, personal site…).
export interface PortfolioLink { label: string; url: string }
export const MAX_PORTFOLIO_LINKS = 5;

// Accepts what people actually type ("github.com/me", "https://…") and returns a
// safe http(s) URL, or null if it isn't one — never javascript:, data:, etc.,
// since these render as clickable links on a public page.
export function normalizePortfolioUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export type BoardVisibility = {
  portfolio?: boolean;
  bio?: boolean;
  year_major?: boolean;
  socials?: boolean;
  pronouns?: boolean;
  email?: boolean;
};

// Every key defaults to hidden (false) when absent — showing anything
// beyond name/picture/title (the fields with no toggle at all) is an
// explicit opt-IN a member turns on themselves in their profile, not
// something that's on until they notice and turn it off. This matters most
// now that officer is auto-shown on the board alongside exec/lead (see
// getBoardMembers) — someone who's never touched these toggles shouldn't
// be outed with a bio/pronouns/socials they never chose to publish just
// because their role newly qualifies them for the roster.
export function isVisible(visibility: BoardVisibility | null | undefined, key: keyof BoardVisibility): boolean {
  return visibility?.[key] ?? false;
}
