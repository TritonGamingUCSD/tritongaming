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
