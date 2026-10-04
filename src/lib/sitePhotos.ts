// Real club photos that ship with the site, each with who took it. Anything shown on a page must carry its credit.
// To add one: drop the file in /public/images and add it here with the photographer's name (and link if they have one).
export type SitePhoto = { src: string; alt: string; credit: string; creditUrl?: string };

export const SITE_PHOTOS = {
  inside: { src: '/images/inside_tg.jpg', alt: 'Officers running an event on stage', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
  community: { src: '/images/community_tg.jpg', alt: 'Members playing mahjong at a social', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
  events: { src: '/images/events_tg.JPG', alt: 'A hall full of gaming PCs at a TG event', credit: 'Mina Yang', creditUrl: 'https://www.instagram.com/tritongamingsd' },
  stage: { src: '/images/what_is_triton_gaming_justinlu.jpg', alt: 'Officers and members at a Triton Gaming event', credit: 'Justin Lu', creditUrl: 'https://www.instagram.com/justinzlu/' },
} satisfies Record<string, SitePhoto>;
