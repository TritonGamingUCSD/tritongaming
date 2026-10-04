// Per-event themes: a big event's design guide (palette, fonts, posters, stickers) re-skins its public page. Everything here is
// client-safe and defensive: values come from a database column an editor filled in, so every field is checked before it reaches CSS or a URL.

// Who made a picture, keyed by the picture's address. `link` is their portfolio or social page.
export interface AssetCredit { name: string; link?: string }

export interface CustomFont { name: string; url: string }

export interface EventTheme {
  colors: { bg?: string; surface?: string; text?: string; accent?: string; highlight?: string };
  // display = the event title, heading = section headings, accent = small notes and labels, body = running text.
  fonts: { display?: string; heading?: string; accent?: string; body?: string };
  // Font files an editor uploaded (the design guide's own fonts). They show up in the font pickers next to the Google Fonts.
  custom_fonts?: CustomFont[];
  asset_credits?: Record<string, AssetCredit>;
  // The event's posters, in order. The first is the main one at the top of the page; with more than one the page shows a small gallery.
  posters?: string[];
  stickers: string[];
}

export const EMPTY_THEME: EventTheme = { colors: {}, fonts: {}, stickers: [] };
export const MAX_STICKERS = 8;
export const MAX_POSTERS = 8;
export const MAX_CUSTOM_FONTS = 6;
export const FONT_FILE_TYPES = ['woff2', 'woff', 'ttf', 'otf'];

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
// A font file address goes into CSS url(...), so it must be https (or a site path) with a font extension and no characters that could end the url early.
const isFontUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)[^\s"'()<>\\]+\.(woff2|woff|ttf|otf)$/i.test(v) && v.length < 600;
const isWebLink = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v) && v.length < 400;
const isUrl = (v: unknown): v is string => typeof v === 'string' && /^(https:\/\/|\/)/.test(v) && v.length < 600;

export function cleanTheme(raw: unknown): EventTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colors: EventTheme['colors'] = {};
  const c = (r.colors ?? {}) as Record<string, unknown>;
  for (const f of COLOR_FIELDS) if (typeof c[f.key] === 'string' && HEX.test(c[f.key] as string)) colors[f.key] = (c[f.key] as string).toLowerCase();
  const fonts: EventTheme['fonts'] = {};
  const fo = (r.fonts ?? {}) as Record<string, unknown>;
  for (const k of ['display', 'heading', 'accent', 'body'] as const) {
    const v = fo[k];
    if (typeof v === 'string' && FONT.test(v.trim())) fonts[k] = v.trim();
  }
  const custom_fonts: CustomFont[] = Array.isArray(r.custom_fonts)
    ? (r.custom_fonts as unknown[])
        .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
        .filter((f): f is { name: string; url: string } => typeof f.name === 'string' && FONT.test(f.name.trim()) && isFontUrl(f.url))
        .map((f) => ({ name: f.name.trim(), url: f.url }))
        .slice(0, MAX_CUSTOM_FONTS)
    : [];
  // Posters: the new list, plus the older single "page poster" and "more posters" fields folded in (same order: main first, then the rest).
  const posters = [...new Set([...(Array.isArray(r.posters) ? r.posters : []), r.key_art_url, ...(Array.isArray(r.extra_posters) ? r.extra_posters : [])].filter(isUrl) as string[])].slice(0, MAX_POSTERS);
  const theme: EventTheme = {
    colors, fonts,
    ...(custom_fonts.length ? { custom_fonts } : {}),
    ...(posters.length ? { posters } : {}),
    stickers: Array.isArray(r.stickers) ? (r.stickers.filter(isUrl) as string[]).slice(0, MAX_STICKERS) : [],
  };
  // Credits only for pictures this theme still uses.
  const used = new Set([...(theme.posters ?? []), ...theme.stickers].filter(Boolean) as string[]);
  const rawCredits = r.asset_credits && typeof r.asset_credits === 'object' ? (r.asset_credits as Record<string, unknown>) : {};
  const asset_credits: Record<string, AssetCredit> = {};
  for (const [url, v] of Object.entries(rawCredits)) {
    if (!used.has(url) || !v || typeof v !== 'object') continue;
    const name = typeof (v as AssetCredit).name === 'string' ? (v as AssetCredit).name.trim().slice(0, 60) : '';
    if (!name) continue;
    const link = (v as AssetCredit).link;
    asset_credits[url] = isWebLink(link) ? { name, link } : { name };
  }
  if (Object.keys(asset_credits).length) theme.asset_credits = asset_credits;
  const empty = Object.keys(colors).length === 0 && Object.keys(fonts).length === 0 && !theme.custom_fonts && !theme.asset_credits && !theme.posters && theme.stickers.length === 0;
  return empty ? null : theme;
}

// Black or white, whichever reads better on this color. Used so text on an editor's accent color is always legible.
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#011941' : '#ffffff';
}

export function themeVars(theme: EventTheme | null): Record<string, string> {
  const c = theme?.colors ?? {};
  const accent = c.accent ?? '#ffc72c';
  const surface = c.surface ?? '#f2f1f0';
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
  if (theme?.fonts.display) vars['--ev-font-display'] = `'${theme.fonts.display}', var(--font-futura-heavy), sans-serif`;
  if (theme?.fonts.accent) vars['--ev-font-accent'] = `'${theme.fonts.accent}', var(--font-brick), cursive`;
  if (theme?.fonts.heading) vars['--ev-font-heading'] = `'${theme.fonts.heading}', var(--font-futura-heavy), sans-serif`;
  if (theme?.fonts.body) vars['--ev-font-body'] = `'${theme.fonts.body}', var(--font-futura-medium), sans-serif`;
  return vars;
}

export function themeFontsHref(theme: EventTheme | null): string | null {
  const own = new Set((theme?.custom_fonts ?? []).map((f) => f.name));
  const f = theme?.fonts ?? {};
  const names = [...new Set([f.display, f.heading, f.accent, f.body].filter((n): n is string => !!n && !own.has(n)))];
  if (names.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${names.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, '+')}`).join('&')}&display=swap`;
}

const FORMAT: Record<string, string> = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

// @font-face rules for the uploaded fonts that a role actually uses. Names and urls were validated in cleanTheme, so this string is safe to inline.
export function themeFontFaceCss(theme: EventTheme | null): string | null {
  const used = new Set(Object.values(theme?.fonts ?? {}));
  const faces = (theme?.custom_fonts ?? []).filter((f) => used.has(f.name)).map((f) => {
    const ext = f.url.split('.').pop()!.toLowerCase();
    return `@font-face{font-family:'${f.name}';src:url('${f.url}') format('${FORMAT[ext] ?? 'woff2'}');font-display:swap;}`;
  });
  return faces.length ? faces.join('') : null;
}
