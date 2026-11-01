// The Photo Booth's settings and the maths of its pictures. Plain data and pure functions only (no browser, no server), so the setup screen, the booth, the routes and the tests share one set of rules.

export const LAYOUTS = ['single', 'grid', 'strip3', 'strip4'] as const;
export type Layout = (typeof LAYOUTS)[number];
export const LAYOUT_NAMES: Record<Layout, string> = { single: 'One Photo', grid: 'Four In A Grid', strip3: 'Strip Of Three', strip4: 'Strip Of Four' };
export const ASPECTS = ['portrait', 'square', 'wide'] as const;
export type Aspect = (typeof ASPECTS)[number];
export const ASPECT_NAMES: Record<Aspect, string> = { portrait: 'Portrait (3:4)', square: 'Square (1:1)', wide: 'Wide (4:3)' };
export const FILTERS = ['none', 'bw', 'warm', 'vivid'] as const;
export type Filter = (typeof FILTERS)[number];
export const FILTER_NAMES: Record<Filter, string> = { none: 'Natural', bw: 'Black And White', warm: 'Warm', vivid: 'Vivid' };

/** How many photos a layout takes. */
export const SHOTS: Record<Layout, number> = { single: 1, grid: 4, strip3: 3, strip4: 4 };

/** One sticker on one photo: its centre and width as fractions of the photo, and its turn in degrees. */
export interface Placement {
  x: number;
  y: number;
  size: number;
  rotation: number;
}

/** A sticker of a look. `placements` has an entry for each photo of the strip (up to 4): where it sits on that photo, or null when that photo does not show it (dragged onto a photo from the tray to show it there). */
export interface Overlay {
  id: string;
  name: string;
  kind: 'frame' | 'sticker';
  image: string;
  placements: (Placement | null)[];
}

/** The most photos one picture holds. */
export const MAX_PHOTOS = 4;
/** Where a new sticker starts on a photo. */
export const DEFAULT_PLACEMENT: Placement = { x: 0.5, y: 0.5, size: 0.4, rotation: 0 };

const num = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

/** One placement from anything a screen might send (null stays null). */
export function cleanPlacement(v: unknown): Placement | null {
  if (!v || typeof v !== 'object') return null;
  const b = v as Record<string, unknown>;
  return { x: num(b.x, 0, 1, 0.5), y: num(b.y, 0, 1, 0.5), size: num(b.size, 0.05, 1, 0.4), rotation: num(b.rotation, -180, 180, 0) };
}

/** A sticker's placements: an entry for each of the 4 possible photos (null: that photo does not show it; a new sticker waits in the tray on no photo at all). */
export function cleanPlacements(v: unknown): (Placement | null)[] {
  const list = Array.isArray(v) ? v : [];
  return Array.from({ length: MAX_PHOTOS }, (_, i) => cleanPlacement(list[i]));
}

/** The placements with photo `i` changed (null takes the sticker off that photo). */
export function withPlacement(placements: (Placement | null)[], i: number, p: Placement | null): (Placement | null)[] {
  return cleanPlacements(placements).map((q, k) => (k === i ? p : q));
}

/** The placements with photo `i`'s placement copied to every one of the layout's `count` photos. */
export function copyPlacementToAll(placements: (Placement | null)[], i: number, count: number): (Placement | null)[] {
  const from = placements[i];
  return from ? cleanPlacements(placements).map((q, k) => (k < count ? { ...from } : q)) : cleanPlacements(placements);
}

export interface BoothConfig {
  layout: Layout;
  aspect: Aspect;
  countdown: number;
  filter: Filter;
  strip_bg: string;
  text_color: string;
  accent: string;
  /** The host screen's background and its text and outlines ('' = the website's own colours). */
  screen_bg: string;
  screen_ink: string;
  footer: string;
  welcome_title: string;
  welcome_text: string;
  prompts: string[];
  sounds: boolean;
  flash: boolean;
  qr_seconds: number;
  keep_days: number;
}

export const DEFAULT_BOOTH: BoothConfig = {
  layout: 'strip3',
  aspect: 'portrait',
  countdown: 3,
  filter: 'none',
  strip_bg: '#ffffff',
  text_color: '#011941',
  accent: '#facc15',
  screen_bg: '',
  screen_ink: '',
  footer: '',
  welcome_title: 'Photo Booth',
  welcome_text: 'Tap to start',
  prompts: [],
  sounds: true,
  flash: true,
  qr_seconds: 60,
  keep_days: 7,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const int = (v: unknown, min: number, max: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);
const text = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => (all.includes(v as T) ? (v as T) : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback);

/** A booth's settings from anything a screen might send: every field is brought into range, and anything unreadable is the default. */
export function cleanBooth(input: unknown, base: BoothConfig = DEFAULT_BOOTH): BoothConfig {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const prompts = Array.isArray(b.prompts)
    ? b.prompts
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 6)
    : base.prompts;
  return {
    layout: oneOf(b.layout, LAYOUTS, base.layout),
    aspect: oneOf(b.aspect, ASPECTS, base.aspect),
    countdown: int(b.countdown, 1, 10, base.countdown),
    filter: oneOf(b.filter, FILTERS, base.filter),
    strip_bg: color(b.strip_bg, base.strip_bg),
    text_color: color(b.text_color, base.text_color),
    accent: color(b.accent, base.accent),
    screen_bg: b.screen_bg === '' ? '' : color(b.screen_bg, base.screen_bg),
    screen_ink: b.screen_ink === '' ? '' : color(b.screen_ink, base.screen_ink),
    footer: text(b.footer, 80, base.footer),
    welcome_title: text(b.welcome_title, 60, base.welcome_title) || base.welcome_title,
    welcome_text: text(b.welcome_text, 120, base.welcome_text),
    prompts,
    sounds: typeof b.sounds === 'boolean' ? b.sounds : base.sounds,
    flash: typeof b.flash === 'boolean' ? b.flash : base.flash,
    qr_seconds: int(b.qr_seconds, 10, 300, base.qr_seconds),
    keep_days: int(b.keep_days, 1, 7, base.keep_days),
  };
}

/** A colour as 'r, g, b' for use in rgba(). */
export const hexToRgb = (hex: string): string => `${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}`;

/** What a look decides about the finished picture (the rest of BoothConfig is the booth's own). */
export const LOOK_STYLE_KEYS = ['layout', 'aspect', 'strip_bg', 'text_color', 'footer', 'filter'] as const;
export type LookStyle = Pick<BoothConfig, (typeof LOOK_STYLE_KEYS)[number]>;
export type BoothSettings = Omit<BoothConfig, (typeof LOOK_STYLE_KEYS)[number]>;

/** A booth's full settings split into what the booth keeps and what a look keeps (both brought into range). */
export function splitConfig(config: BoothConfig): { settings: BoothSettings; style: LookStyle } {
  const full = cleanBooth(config);
  const { layout, aspect, strip_bg, text_color, footer, filter, ...settings } = full;
  return { settings, style: { layout, aspect, strip_bg, text_color, footer, filter } };
}

/** The most looks one booth can offer. */
export const MAX_LOOKS_PER_BOOTH = 6;

/** The most stickers one look can have. */
export const MAX_STICKERS_PER_LOOK = 24;

/** A sticker's placements, brought into range. */
export const cleanSticker = (b: Record<string, unknown>): Pick<Overlay, 'placements'> => ({ placements: cleanPlacements(b.placements) });

// ── The booth's own frame (drawn over each photo; designed on the booth's setup page, never shared between booths) ──
export const BORDERS = ['none', 'solid', 'rounded', 'double'] as const;
export type BorderStyle = (typeof BORDERS)[number];
export const BORDER_NAMES: Record<BorderStyle, string> = { none: 'No Border', solid: 'Solid', rounded: 'Rounded Inside', double: 'Double Line' };
export const LOGO_SPOTS = ['top-left', 'top', 'top-right', 'bottom-left', 'bottom', 'bottom-right'] as const;
export type LogoSpot = (typeof LOGO_SPOTS)[number];
export const LOGO_SPOT_NAMES: Record<LogoSpot, string> = {
  'top-left': 'Top Left',
  top: 'Top Middle',
  'top-right': 'Top Right',
  'bottom-left': 'Bottom Left',
  bottom: 'Bottom Middle',
  'bottom-right': 'Bottom Right',
};
/** Where each named spot puts the middle of the logo (as fractions of the photo). */
export const LOGO_SPOT_AT: Record<LogoSpot, { x: number; y: number }> = {
  'top-left': { x: 0.18, y: 0.12 },
  top: { x: 0.5, y: 0.12 },
  'top-right': { x: 0.82, y: 0.12 },
  'bottom-left': { x: 0.18, y: 0.88 },
  bottom: { x: 0.5, y: 0.88 },
  'bottom-right': { x: 0.82, y: 0.88 },
};

/** What a frame is made of (the shape of the photo comes from the booth). `logoUrl` is the booth's logo file, or '' for none. */
export interface FrameSpec {
  border: BorderStyle;
  color: string;
  width: number;
  top: string;
  bottom: string;
  band: string;
  text: string;
  /** The height of a line of words, as a fraction of the photo's height. */
  wordsSize: number;
  /** Where the top and the bottom words sit (the middle of the words, as fractions of the photo), or null for the edge they start at. */
  topX: number | null;
  topY: number | null;
  bottomX: number | null;
  bottomY: number | null;
  logoUrl: string;
  /** The middle of the logo, as fractions of the photo, and its width as a fraction of the photo's width. */
  logoX: number;
  logoY: number;
  logoSize: number;
}
/** The starting height of a line of words. */
export const WORDS_SIZE = 0.09;
export const DEFAULT_FRAME_SPEC: FrameSpec = {
  border: 'rounded',
  color: '#facc15',
  width: 22,
  top: '',
  bottom: '',
  band: '#011941',
  text: '#ffffff',
  wordsSize: WORDS_SIZE,
  topX: null,
  topY: null,
  bottomX: null,
  bottomY: null,
  logoUrl: '',
  logoX: LOGO_SPOT_AT['top-right'].x,
  logoY: LOGO_SPOT_AT['top-right'].y,
  logoSize: 0.2,
};

/** A frame spec from anything a screen might send, every field brought into range (a frame saved with a named logo spot keeps its place). */
export function cleanFrameSpec(input: unknown, base: FrameSpec = DEFAULT_FRAME_SPEC): FrameSpec {
  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  const spot = typeof b.logoSpot === 'string' && (LOGO_SPOTS as readonly string[]).includes(b.logoSpot) ? LOGO_SPOT_AT[b.logoSpot as LogoSpot] : null;
  const opt = (v: unknown, d: number | null) => (v === null ? null : typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
  return {
    border: oneOf(b.border, BORDERS, base.border),
    color: color(b.color, base.color),
    width: Math.round(num(b.width, 4, 60, base.width)),
    top: text(b.top, 40, base.top),
    bottom: text(b.bottom, 40, base.bottom),
    band: color(b.band, base.band),
    text: color(b.text, base.text),
    wordsSize: num(b.wordsSize, 0.04, 0.2, base.wordsSize),
    topX: opt(b.topX, base.topX),
    topY: opt(b.topY, base.topY),
    bottomX: opt(b.bottomX, base.bottomX),
    bottomY: opt(b.bottomY, base.bottomY),
    logoUrl: typeof b.logoUrl === 'string' && /^https?:\/\//.test(b.logoUrl) ? b.logoUrl.slice(0, 500) : '',
    logoX: num(b.logoX, 0, 1, spot?.x ?? base.logoX),
    logoY: num(b.logoY, 0, 1, spot?.y ?? base.logoY),
    logoSize: num(b.logoSize, 0.08, 0.5, base.logoSize),
  };
}

/** One piece of a frame placed on a photo `w` by `h` pixels: where its middle is and how big it is. */
export interface FramePiece {
  cx: number;
  cy: number;
  w: number;
  h: number;
}
export interface FrameLayout {
  /** How thick the border is, in pixels. */
  border: number;
  /** The strip behind each line of words (null when that line is empty) and where its words are centred. */
  top: (FramePiece & { x: number; y: number }) | null;
  bottom: (FramePiece & { x: number; y: number }) | null;
  logo: FramePiece | null;
}

/** Where every part of a frame sits on a photo `w` by `h` pixels (`logoRatio` is the logo's height ÷ width, or null for none). The drawing and the editor on the booth's setup page both use this, so they always agree. */
export function frameLayout(spec: FrameSpec, w: number, h: number, logoRatio: number | null): FrameLayout {
  const t = spec.border === 'none' ? 0 : spec.width;
  const bandH = h * spec.wordsSize;
  const clampY = (y: number) => Math.min(h - t - bandH / 2, Math.max(t + bandH / 2, y));
  const line = (words: string, atTop: boolean, x: number | null, y: number | null) => {
    if (!words.trim()) return null;
    const cy = clampY(y === null ? (atTop ? t + bandH / 2 : h - t - bandH / 2) : y * h);
    return { cx: w / 2, cy, w: w - 2 * t, h: bandH, x: x === null ? w / 2 : x * w, y: cy };
  };
  const lw = w * spec.logoSize;
  return {
    border: t,
    top: line(spec.top, true, spec.topX, spec.topY),
    bottom: line(spec.bottom, false, spec.bottomX, spec.bottomY),
    logo: logoRatio === null || !spec.logoUrl ? null : { cx: spec.logoX * w, cy: spec.logoY * h, w: lw, h: lw * logoRatio },
  };
}

// ── The picture ───────────────────────────────────────────────────────────────

/** One photo's width in pixels in the finished picture; its height follows the aspect. */
export const CELL_W = 720;
const MARGIN = 40;
const GAP = 24;
const FOOTER_H = 120;
const FOOTER_THIN = 40;

export const cellSize = (aspect: Aspect): { w: number; h: number } => ({ w: CELL_W, h: aspect === 'portrait' ? 960 : aspect === 'square' ? 720 : 540 });
/** The shape of one photo (width ÷ height), for the camera crop and for the frames' design size. */
export const cellRatio = (aspect: Aspect): number => cellSize(aspect).w / cellSize(aspect).h;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Composition {
  width: number;
  height: number;
  cells: Rect[];
  footer: Rect;
}

/** Where every photo and the footer sit on the finished picture. */
export function composition(layout: Layout, aspect: Aspect, hasFooter: boolean): Composition {
  const { w, h } = cellSize(aspect);
  const cols = layout === 'grid' ? 2 : 1;
  const rows = layout === 'grid' ? 2 : SHOTS[layout];
  const cells: Rect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: MARGIN + c * (w + GAP), y: MARGIN + r * (h + GAP), w, h });
  const width = MARGIN * 2 + cols * w + (cols - 1) * GAP;
  const photosBottom = MARGIN + rows * h + (rows - 1) * GAP;
  const footerH = hasFooter ? FOOTER_H : FOOTER_THIN;
  return { width, height: photosBottom + footerH + (hasFooter ? MARGIN / 2 : 0), cells, footer: { x: 0, y: photosBottom, w: width, h: footerH } };
}

/** The prompt shown before shot `i` (0-based): the host's own words in order, the last one repeating. Nothing when there are none. */
export const promptFor = (prompts: string[], i: number): string => (prompts.length ? prompts[Math.min(i, prompts.length - 1)] : '');

/** The URL of a finished picture's page. */
export const photoLink = (token: string, origin: string): string => `${origin.replace(/\/$/, '')}/photos/${token}`;

/** A sticker's centre and width on one photo, in pixels, from its fractions. */
export function stickerBox(cell: Rect, s: { x: number; y: number; size: number }): { cx: number; cy: number; w: number } {
  return { cx: cell.x + s.x * cell.w, cy: cell.y + s.y * cell.h, w: s.size * cell.w };
}

/** The time a finished picture stops being available. */
export const expiresAt = (now: Date, keepDays: number): Date => new Date(now.getTime() + keepDays * 86_400_000);

/** A filter applied to the pixels of a picture (r, g, b, a in a flat array), in place. Done by hand because not every phone's canvas can apply a filter itself. */
export function applyFilter(data: Uint8ClampedArray, filter: Filter): void {
  if (filter === 'none') return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (filter === 'bw') {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = data[i + 1] = data[i + 2] = y;
    } else if (filter === 'warm') {
      data[i] = r * 1.08 + 8;
      data[i + 1] = g * 1.02;
      data[i + 2] = b * 0.9;
    } else {
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const k = 1.35; // more colour
      data[i] = (y + (r - y) * k - 128) * 1.08 + 128;
      data[i + 1] = (y + (g - y) * k - 128) * 1.08 + 128;
      data[i + 2] = (y + (b - y) * k - 128) * 1.08 + 128;
    }
  }
}

/** The same filter as a CSS filter, for the live camera picture. */
export const FILTER_CSS: Record<Filter, string> = { none: 'none', bw: 'grayscale(1)', warm: 'sepia(0.28) saturate(1.1) brightness(1.03)', vivid: 'saturate(1.45) contrast(1.08)' };
