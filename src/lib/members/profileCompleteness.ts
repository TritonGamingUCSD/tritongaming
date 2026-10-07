import type { Profile } from '@/types/database';
import type { MyPrivateProfile } from '@/lib/core/auth';
import type { RoleGrant } from '@/lib/portal/capabilities';

export interface ProfileNudge { percent: number; missing: { key: string; label: string; href: string }[] }

// How filled-in the optional parts of a profile are, for the friendly "finish your profile" nudge on the Dashboard. The
// required fields have their own banner (getMissingProfileFields); this is only about the nice-to-haves.
export function profileNudge(profile: Profile, priv: MyPrivateProfile, roles: RoleGrant[]): ProfileNudge {
  const team = roles.some((r) => ['exec', 'lead', 'officer', 'recruit'].includes(r.role));
  const hasSocial = Object.values((profile.social_links ?? {}) as Record<string, string>).some((v) => String(v).trim());
  const items: { key: string; label: string; href: string; done: boolean }[] = [
    { key: 'photo', label: 'Add a profile picture', href: '/portal/profile', done: !!(profile.custom_avatar_url || profile.avatar_url) },
    { key: 'gamertag', label: 'Pick a gamer tag', href: '/portal/profile', done: !!profile.gamer_tag?.trim() },
    { key: 'games', label: 'Add your favorite games', href: '/portal/profile', done: !!priv.favorite_games?.trim() },
    { key: 'platforms', label: 'Say where you play (PC, console…)', href: '/portal/profile', done: (priv.platforms ?? []).length > 0 },
    ...(team ? [
      { key: 'gameids', label: 'Add your game IDs (Steam, Riot…)', href: '/portal/profile/card', done: ((profile.game_ids ?? []) as unknown[]).length > 0 },
      { key: 'bio', label: 'Write a short bio', href: '/portal/profile/card', done: !!profile.bio?.trim() },
      { key: 'social', label: 'Add a social link', href: '/portal/profile/card', done: hasSocial },
    ] : []),
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), missing: items.filter((i) => !i.done).map(({ key, label, href }) => ({ key, label, href })) };
}
