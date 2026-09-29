import type { Profile, AppRole } from '@/types/database';

// A profile counts as an org member for the portal's Members roster if it
// holds any role besides the auto-granted 'ucsd' verified-student badge —
// a bare 'ucsd' (or zero roles at all) means "verified/logged-in visitor,"
// not someone who's actually joined anything. Lives here (not
// getMembersData.ts, which pulls in the server-only Supabase client) so
// the client-side MembersSectionContent can share it with the server-side
// getMembersData without dragging next/headers into the client bundle.
export function isOrgMember(userRoles: Array<{ role: AppRole }> | null | undefined): boolean {
  const roles = new Set((userRoles ?? []).map((r) => r.role));
  return !(roles.size === 0 || (roles.size === 1 && roles.has('ucsd')));
}

// "Basic info" required before someone can claim a ticket — checked once,
// tied to their account, so they're never asked again after it's filled in.
// Gamer tag, pronouns, bio, and birthday are intentionally never required.
//
// Year/college/major are only required for verified members (isUcsd — see
// isVerifiedMember in lib/capabilities.ts) — a non-UCSD guest just needs a name.
export function hasBasicProfileInfo(profile: Pick<Profile, 'display_name' | 'major' | 'year' | 'college'>, isUcsd: boolean): boolean {
  if (!profile.display_name?.trim()) return false;
  if (!isUcsd) return true;
  return !!profile.major?.trim() && !!profile.year?.trim() && !!profile.college?.trim();
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

export type BoardVisibility = {
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
