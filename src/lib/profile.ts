import type { Profile } from '@/types/database';

// "Basic info" required before someone can claim a ticket — checked once,
// tied to their account, so they're never asked again after it's filled in.
export function hasBasicProfileInfo(profile: Pick<Profile, 'display_name' | 'major' | 'year'>): boolean {
  return !!profile.display_name?.trim() && !!profile.major?.trim() && !!profile.year?.trim();
}
