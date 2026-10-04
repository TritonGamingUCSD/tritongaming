// Per-event themes: a big event's design guide (palette, fonts, key art, pattern, stickers) re-skins its public page. Everything here is
// client-safe and defensive: values come from a database column an editor filled in, so every field is checked before it reaches CSS or a URL.

export interface EventTheme {
  colors: { bg?: string; surface?: string; text?: string; accent?: string; highlight?: string };
  fonts: { heading?: string; body?: string };
  key_art_url?: string;
  logo_url?: string;
  pattern_url?: string;
  stickers: string[];
  // Who made the art and photos (shown small on the event page), e.g. "Key art by Sam L. · Photos by the media team".
  credit?: string;
}

export const EMPTY_THEME: EventTheme = { colors: {}, fonts: {}, stickers: [] };
export const MAX_STICKERS = 8;

export const COLOR_FIELDS: { key: keyof EventTheme['colors']; label: string; hint: string }[] = [
  { key: 'bg', label: 'Background', hint: 'The page behind everything.' },
  { key: 'surface', label: 'Surface', hint: 'Paper cards and notes.' },
  { key: 'text', label: 'Text', hint: 'Main text color on the background.' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, tags, highlights.' },
  { key: 'highlight', label: 'Highlight', hint: 'A second pop of color.' },
];

// A curated list so the page stays fast and the names are always valid; "Other" lets an editor type any Google Font name.
export const FONT_CHOICES = ['Bungee', 'Bowlby One', 'Rubik Mono One', 'Chakra Petch', 'Press Start 2P', 'Permanent Marker', 'Caveat', 'Anton', 'Archivo Black', 'Space Mono', 'DM Serif Display', 'Fredoka', 'Lilita One', 'Righteous', 'Barlow Condensed'];

const HEX = /^#[0-9a-fA-F]{6}$/;
const FONT = /^[A-Za-z0-9 ]{2,40}$/;
const isUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)/.test(v) && v.length < 600;

export function cleanTheme(raw: unknown): EventTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colors: EventTheme['colors'] = {};
  const c = (r.colors ?? {}) as Record<string, unknown>;
  for (const f of COLOR_FIELDS) if (typeof c[f.key] === 'string' && HEX.test(c[f.key] as string)) colors[f.key] = (c[f.key] as string).toLowerCase();
  const fonts: EventTheme['fonts'] = {};
  const fo = (r.fonts ?? {}) as Record<string, unknown>;
  if (typeof fo.heading === 'string' && FONT.test(fo.heading.trim())) fonts.heading = fo.heading.trim();
  if (typeof fo.body === 'string' && FONT.test(fo.body.trim())) fonts.body = fo.body.trim();
  const theme: EventTheme = {
    colors, fonts,
    ...(isUrl(r.key_art_url) ? { key_art_url: r.key_art_url } : {}),
    ...(isUrl(r.logo_url) ? { logo_url: r.logo_url } : {}),
    ...(isUrl(r.pattern_url) ? { pattern_url: r.pattern_url } : {}),
    stickers: Array.isArray(r.stickers) ? (r.stickers.filter(isUrl) as string[]).slice(0, MAX_STICKERS) : [],
    ...(typeof r.credit === 'string' && r.credit.trim() ? { credit: r.credit.trim().slice(0, 160) } : {}),
  };
  const empty = Object.keys(colors).length === 0 && Object.keys(fonts).length === 0 && !theme.key_art_url && !theme.logo_url && !theme.pattern_url && theme.stickers.length === 0 && !theme.credit;
  return empty ? null : theme;
}

// Black or white, whichever reads better on this color. Used so text on an editor's accent color is always legible.
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a1630' : '#ffffff';
}

export function themeVars(theme: EventTheme | null): Record<string, string> {
  const c = theme?.colors ?? {};
  const accent = c.accent ?? '#ffc72c';
  const surface = c.surface ?? '#f2efe6';
  const vars: Record<string, string> = {
    '--ev-bg': c.bg ?? '#050d1f',
    '--ev-surface': surface,
    '--ev-on-surface': readableOn(surface),
    '--ev-text': c.text ?? '#f2f1f0',
    '--ev-accent': accent,
    '--ev-on-accent': readableOn(accent),
    '--ev-highlight': c.highlight ?? '#9fc4e8',
    '--ev-on-highlight': readableOn(c.highlight ?? '#9fc4e8'),
  };
  if (theme?.fonts.heading) vars['--ev-font-heading'] = `'${theme.fonts.heading}', var(--font-futura-heavy), sans-serif`;
  if (theme?.fonts.body) vars['--ev-font-body'] = `'${theme.fonts.body}', var(--font-futura-medium), sans-serif`;
  return vars;
}

export function themeFontsHref(theme: EventTheme | null): string | null {
  const names = [...new Set([theme?.fonts.heading, theme?.fonts.body].filter((n): n is string => !!n))];
  if (names.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${names.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, '+')}`).join('&')}&display=swap`;
}
