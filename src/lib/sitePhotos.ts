import { getContentBlock } from '@/lib/content';

// Real club photos that ship with the site, each with who took it. Anything shown on a page must carry its credit.
// To add one: drop the file in /public/images and add it here with the photographer's name (and link if they have one).
export type SitePhoto = { src: string; alt: string; credit: string; creditUrl?: string };

export const SITE_PHOTOS = {
  inside: { src: '/images/inside_tg.jpg', alt: 'Officers running an event on stage', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
  community: { src: '/images/community_tg.jpg', alt: 'Members playing mahjong at a social', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
  events: { src: '/images/events_tg.JPG', alt: 'A hall full of gaming PCs at a TG event', credit: 'Mina Yang', creditUrl: 'https://www.instagram.com/tritongamingsd' },
  stage: { src: '/images/what_is_triton_gaming_justinlu.jpg', alt: 'Officers and members at a Triton Gaming event', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
} satisfies Record<string, SitePhoto>;

const DEFAULTS: SitePhoto[] = [SITE_PHOTOS.inside, SITE_PHOTOS.community, SITE_PHOTOS.events, SITE_PHOTOS.stage];

// The photos an editor uploaded in Site Content (Site Photos), each with a credit. With none uploaded, the built-in ones are used.
// A photo without a credit is skipped, since every photo must carry one.
export async function getSitePhotos(): Promise<SitePhoto[]> {
  try {
    const block = (await getContentBlock('site.photos')) as { items?: { src?: string; credit?: string; credit_url?: string; alt?: string }[] };
    const items = (block.items ?? []).filter((p) => p.src && p.credit?.trim());
    if (items.length === 0) return DEFAULTS;
    return items.map((p) => ({ src: p.src!, alt: p.alt?.trim() || 'A Triton Gaming event', credit: p.credit!.trim(), creditUrl: p.credit_url?.trim() || undefined }));
  } catch {
    return DEFAULTS;
  }
}

// `count` photos starting at `offset`, wrapping around, so each page's strip shows a different mix from the same set.
export function pickPhotos(all: SitePhoto[], offset: number, count: number): SitePhoto[] {
  const n = Math.min(count, all.length);
  return Array.from({ length: n }, (_, i) => all[(offset + i) % all.length]);
}
