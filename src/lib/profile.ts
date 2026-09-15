import type { Profile } from '@/types/database';

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

// avatar_url is never touched by the custom-picture feature — it stays
// exactly what Google sync last set it to. custom_avatar_url, when set,
// wins everywhere a profile picture is displayed; an empty/unset value
// falls back to avatar_url automatically.
export function resolveAvatarUrl(profile: { avatar_url: string | null; custom_avatar_url?: string | null }): string | null {
  return profile.custom_avatar_url?.trim() || profile.avatar_url;
}
