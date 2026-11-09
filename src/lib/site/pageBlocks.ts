// Page sections for event, division and other pages: an editor builds the page from designed blocks instead of one long piece of Markdown.
// Everything here is client-safe and defensive: the values come from a database column an editor filled in, so each field is checked
// (type, length, URL shape, allowed video sites) before it is rendered.

// How a block sits on the page. All of it is optional; without it a block looks the way it always has.
export type BlockStyle = {
  bg?: 'navy' | 'ink' | 'paper' | 'yellow';
  width?: 'narrow' | 'wide' | 'full';
  align?: 'center';
  space?: 'none' | 'sm' | 'lg';
  /** Left out on a phone or on a computer. */
  hide?: 'phone' | 'desktop';
  /** A link to this block: page#anchor. */
  anchor?: string;
};

type Base = { id: string; style?: BlockStyle };
export type TextBlock = Base & { type: 'text'; markdown: string };
export type HighlightsBlock = Base & { type: 'highlights'; items: { label: string; value: string }[] };
export type FaqBlock = Base & { type: 'faq'; items: { q: string; a: string }[] };
export type GalleryBlock = Base & { type: 'gallery'; items: { url: string; caption: string; credit: string }[] };
export type HeroBlock = Base & { type: 'hero'; title: string; sub: string; image: string; credit: string; buttonLabel: string; buttonUrl: string };
export type ImageTextBlock = Base & { type: 'imageText'; image: string; alt: string; credit: string; markdown: string; side: 'left' | 'right' };
export type ColumnsBlock = Base & { type: 'columns'; items: { heading: string; markdown: string }[] };
export type ButtonsBlock = Base & { type: 'buttons'; items: { label: string; url: string; kind: 'primary' | 'secondary' }[] };
export type VideoBlock = Base & { type: 'video'; url: string; caption: string };
export type PeopleBlock = Base & { type: 'people'; items: { name: string; role: string; image: string; url: string }[] };
export type LogosBlock = Base & { type: 'logos'; items: { name: string; image: string; url: string }[] };
export type CountdownBlock = Base & { type: 'countdown'; label: string; at: string; after: string };
export type DividerBlock = Base & { type: 'divider' };
export type CarouselBlock = Base & { type: 'carousel'; items: { url: string; alt: string; credit: string; creditUrl: string; caption: string }[] };
export type PageBlock =
  | TextBlock
  | HighlightsBlock
  | FaqBlock
  | GalleryBlock
  | HeroBlock
  | ImageTextBlock
  | ColumnsBlock
  | ButtonsBlock
  | VideoBlock
  | PeopleBlock
  | LogosBlock
  | CountdownBlock
  | DividerBlock
  | CarouselBlock;
export type BlockType = PageBlock['type'];

export const BLOCK_LIMITS = { blocks: 30, highlights: 4, faq: 12, gallery: 12, columns: 3, buttons: 4, people: 12, logos: 16, carousel: 12 } as const;

export const BLOCK_LABELS: Record<BlockType, { title: string; hint: string }> = {
  text: { title: 'Text', hint: 'A heading and Markdown text.' },
  highlights: { title: 'Highlights', hint: 'Up to 4 big quick facts, like "Thursdays 6-10pm" or "Free".' },
  faq: { title: 'FAQ', hint: 'Questions that open to show the answer.' },
  gallery: { title: 'Photo gallery', hint: 'Photos as polaroids. Every photo needs a credit.' },
  hero: { title: 'Banner', hint: 'A big title over a photo, with an optional button.' },
  imageText: { title: 'Photo and text', hint: 'A photo beside some writing, on the left or the right.' },
  columns: { title: 'Columns', hint: 'Two or three columns of text, each with a heading.' },
  buttons: { title: 'Buttons', hint: 'A row of up to 4 buttons that open a page or link.' },
  video: { title: 'Video', hint: 'A YouTube, Twitch or Vimeo video or stream.' },
  people: { title: 'People', hint: 'Cards with a photo, a name and a role.' },
  logos: { title: 'Logos', hint: 'A row of partner or team logos, each can link somewhere.' },
  countdown: { title: 'Countdown', hint: 'Counts down to a date and time.' },
  divider: { title: 'Divider', hint: 'A hand-drawn line to separate sections.' },
  carousel: { title: 'Photo carousel', hint: 'Photos that slide. Every photo needs a credit.' },
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** An image or page address: https or this site's own. */
export const isUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)/.test(v) && v.length < 600;
/** A link: https, this site's own, or a spot on this page (#name). */
const isLink = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/|#)/.test(v.trim()) && v.trim().length < 600 && !/^\/\//.test(v.trim());
const link = (v: unknown) => (isLink(v) ? v.trim() : '');
const img = (v: unknown) => (isUrl(v) ? v.trim() : '');

const BG = ['navy', 'ink', 'paper', 'yellow'];
const WIDTH = ['narrow', 'wide', 'full'];
const SPACE = ['none', 'sm', 'lg'];
const HIDE = ['phone', 'desktop'];
/** Keeps only the style fields that have a known value. */
export function cleanStyle(raw: unknown): BlockStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const s: BlockStyle = {};
  if (typeof r.bg === 'string' && BG.includes(r.bg)) s.bg = r.bg as BlockStyle['bg'];
  if (typeof r.width === 'string' && WIDTH.includes(r.width)) s.width = r.width as BlockStyle['width'];
  if (r.align === 'center') s.align = 'center';
  if (typeof r.space === 'string' && SPACE.includes(r.space)) s.space = r.space as BlockStyle['space'];
  if (typeof r.hide === 'string' && HIDE.includes(r.hide)) s.hide = r.hide as BlockStyle['hide'];
  const anchor =
    typeof r.anchor === 'string'
      ? r.anchor
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40)
      : '';
  if (anchor) s.anchor = anchor;
  return Object.keys(s).length ? s : undefined;
}

/** The address to put in an embedded player for a video link, or null when the link is not from a site we embed. `host` is this site's own host (Twitch needs it). */
export function videoEmbed(url: string, host = 'tritongaming.org'): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname.replace(/^www\./, '');
  if (h === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (h === 'youtube.com' || h === 'm.youtube.com') {
    const id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|live|shorts)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (h === 'twitch.tv') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'videos' && /^\d{4,15}$/.test(parts[1] ?? '')) return `https://player.twitch.tv/?video=${parts[1]}&parent=${encodeURIComponent(host)}&autoplay=false`;
    return parts.length === 1 && /^\w{2,25}$/.test(parts[0]) ? `https://player.twitch.tv/?channel=${parts[0]}&parent=${encodeURIComponent(host)}&autoplay=false` : null;
  }
  if (h === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return /^\d{5,12}$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

const rid = () => Math.random().toString(36).slice(2, 10);
export function newBlock(type: BlockType): PageBlock {
  const id = rid();
  switch (type) {
    case 'text':
      return { id, type, markdown: '' };
    case 'highlights':
      return {
        id,
        type,
        items: [
          { label: '', value: '' },
          { label: '', value: '' },
          { label: '', value: '' },
        ],
      };
    case 'faq':
      return { id, type, items: [{ q: '', a: '' }] };
    case 'gallery':
      return { id, type, items: [{ url: '', caption: '', credit: '' }] };
    case 'hero':
      return { id, type, title: '', sub: '', image: '', credit: '', buttonLabel: '', buttonUrl: '' };
    case 'imageText':
      return { id, type, image: '', alt: '', credit: '', markdown: '', side: 'left' };
    case 'columns':
      return {
        id,
        type,
        items: [
          { heading: '', markdown: '' },
          { heading: '', markdown: '' },
        ],
      };
    case 'buttons':
      return { id, type, items: [{ label: '', url: '', kind: 'primary' }] };
    case 'video':
      return { id, type, url: '', caption: '' };
    case 'people':
      return { id, type, items: [{ name: '', role: '', image: '', url: '' }] };
    case 'logos':
      return { id, type, items: [{ name: '', image: '', url: '' }] };
    case 'countdown':
      return { id, type, label: '', at: '', after: '' };
    case 'divider':
      return { id, type };
    case 'carousel':
      return { id, type, items: [{ url: '', alt: '', credit: '', creditUrl: '', caption: '' }] };
  }
}

// Drops empty rows and empty blocks, caps lengths, and returns what is left.
export function cleanBlocks(raw: unknown): PageBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PageBlock[] = [];
  for (const b of raw.slice(0, BLOCK_LIMITS.blocks)) {
    if (!b || typeof b !== 'object') continue;
    const r = b as Record<string, unknown>;
    const id = str(r.id, 16) || rid();
    const style = cleanStyle(r.style);
    const st = style ? { style } : {};
    const items = Array.isArray(r.items) ? (r.items as Record<string, unknown>[]).filter((i) => i && typeof i === 'object') : [];
    switch (r.type) {
      case 'text': {
        const markdown = typeof r.markdown === 'string' ? r.markdown.trim().slice(0, 8000) : '';
        if (markdown) out.push({ id, type: 'text', markdown, ...st });
        break;
      }
      case 'highlights': {
        const rows = items
          .map((i) => ({ label: str(i.label, 40), value: str(i.value, 60) }))
          .filter((i) => i.value)
          .slice(0, BLOCK_LIMITS.highlights);
        if (rows.length) out.push({ id, type: 'highlights', items: rows, ...st });
        break;
      }
      case 'faq': {
        const rows = items
          .map((i) => ({ q: str(i.q, 200), a: str(i.a, 2000) }))
          .filter((i) => i.q && i.a)
          .slice(0, BLOCK_LIMITS.faq);
        if (rows.length) out.push({ id, type: 'faq', items: rows, ...st });
        break;
      }
      case 'gallery': {
        const rows = items
          .filter((i) => isUrl(i.url))
          .map((i) => ({ url: i.url as string, caption: str(i.caption, 120), credit: str(i.credit, 80) }))
          .slice(0, BLOCK_LIMITS.gallery);
        if (rows.length) out.push({ id, type: 'gallery', items: rows, ...st });
        break;
      }
      case 'hero': {
        const title = str(r.title, 120);
        if (title)
          out.push({
            id,
            type: 'hero',
            title,
            sub: str(r.sub, 240),
            image: img(r.image),
            credit: str(r.credit, 80),
            buttonLabel: str(r.buttonLabel, 40),
            buttonUrl: link(r.buttonUrl),
            ...st,
          });
        break;
      }
      case 'imageText': {
        const image = img(r.image);
        const markdown = typeof r.markdown === 'string' ? r.markdown.trim().slice(0, 6000) : '';
        if (image || markdown)
          out.push({ id, type: 'imageText', image, alt: str(r.alt, 160), credit: str(r.credit, 80), markdown, side: r.side === 'right' ? 'right' : 'left', ...st });
        break;
      }
      case 'columns': {
        const rows = items
          .map((i) => ({ heading: str(i.heading, 80), markdown: typeof i.markdown === 'string' ? i.markdown.trim().slice(0, 3000) : '' }))
          .filter((i) => i.heading || i.markdown)
          .slice(0, BLOCK_LIMITS.columns);
        if (rows.length) out.push({ id, type: 'columns', items: rows, ...st });
        break;
      }
      case 'buttons': {
        const rows = items
          .map((i) => ({ label: str(i.label, 40), url: link(i.url), kind: i.kind === 'secondary' ? ('secondary' as const) : ('primary' as const) }))
          .filter((i) => i.label && i.url)
          .slice(0, BLOCK_LIMITS.buttons);
        if (rows.length) out.push({ id, type: 'buttons', items: rows, ...st });
        break;
      }
      case 'video': {
        const url = str(r.url, 400);
        if (url && videoEmbed(url)) out.push({ id, type: 'video', url, caption: str(r.caption, 160), ...st });
        break;
      }
      case 'people': {
        const rows = items
          .map((i) => ({ name: str(i.name, 60), role: str(i.role, 80), image: img(i.image), url: link(i.url) }))
          .filter((i) => i.name)
          .slice(0, BLOCK_LIMITS.people);
        if (rows.length) out.push({ id, type: 'people', items: rows, ...st });
        break;
      }
      case 'logos': {
        const rows = items
          .map((i) => ({ name: str(i.name, 60), image: img(i.image), url: link(i.url) }))
          .filter((i) => i.image)
          .slice(0, BLOCK_LIMITS.logos);
        if (rows.length) out.push({ id, type: 'logos', items: rows, ...st });
        break;
      }
      case 'countdown': {
        const at = str(r.at, 40);
        if (at && !Number.isNaN(Date.parse(at))) out.push({ id, type: 'countdown', label: str(r.label, 80), at, after: str(r.after, 120), ...st });
        break;
      }
      case 'divider':
        out.push({ id, type: 'divider', ...st });
        break;
      case 'carousel': {
        const rows = items
          .filter((i) => isUrl(i.url) && str(i.credit, 80))
          .map((i) => ({ url: i.url as string, alt: str(i.alt, 160), credit: str(i.credit, 80), creditUrl: link(i.creditUrl), caption: str(i.caption, 120) }))
          .slice(0, BLOCK_LIMITS.carousel);
        if (rows.length) out.push({ id, type: 'carousel', items: rows, ...st });
        break;
      }
    }
  }
  return out;
}
