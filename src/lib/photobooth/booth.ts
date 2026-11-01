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

export interface Overlay {
  id: string;
  name: string;
  kind: 'frame' | 'sticker';
  image: string;
  /** A sticker's starting centre and width, as fractions of one photo. */
  x: number;
  y: number;
  size: number;
  can_resize: boolean;
  can_rotate: boolean;
}

export interface BoothConfig {
  layout: Layout;
  aspect: Aspect;
  countdown: number;
  mirror: boolean;
  filter: Filter;
  strip_bg: string;
  text_color: string;
  accent: string;
  footer: string;
  welcome_title: string;
  welcome_text: string;
  prompts: string[];
  sounds: boolean;
  flash: boolean;
  qr_seconds: number;
  keep_days: number;
  overlay_ids: string[];
}

export const DEFAULT_BOOTH: BoothConfig = {
  layout: 'strip3',
  aspect: 'portrait',
  countdown: 3,
  mirror: true,
  filter: 'none',
  strip_bg: '#ffffff',
  text_color: '#011941',
  accent: '#facc15',
  footer: '',
  welcome_title: 'Photo Booth',
  welcome_text: 'Tap to start',
  prompts: [],
  sounds: true,
  flash: true,
  qr_seconds: 60,
  keep_days: 7,
  overlay_ids: [],
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const UUID = /^[0-9a-f-]{36}$/i;
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
  const overlay_ids = Array.isArray(b.overlay_ids) ? [...new Set(b.overlay_ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 24) : base.overlay_ids;
  return {
    layout: oneOf(b.layout, LAYOUTS, base.layout),
    aspect: oneOf(b.aspect, ASPECTS, base.aspect),
    countdown: int(b.countdown, 1, 10, base.countdown),
    mirror: typeof b.mirror === 'boolean' ? b.mirror : base.mirror,
    filter: oneOf(b.filter, FILTERS, base.filter),
    strip_bg: color(b.strip_bg, base.strip_bg),
    text_color: color(b.text_color, base.text_color),
    accent: color(b.accent, base.accent),
    footer: text(b.footer, 80, base.footer),
    welcome_title: text(b.welcome_title, 60, base.welcome_title) || base.welcome_title,
    welcome_text: text(b.welcome_text, 120, base.welcome_text),
    prompts,
    sounds: typeof b.sounds === 'boolean' ? b.sounds : base.sounds,
    flash: typeof b.flash === 'boolean' ? b.flash : base.flash,
    qr_seconds: int(b.qr_seconds, 10, 300, base.qr_seconds),
    keep_days: int(b.keep_days, 1, 7, base.keep_days),
    overlay_ids,
  };
}

/** A sticker's starting values and limits, brought into range. */
export function cleanSticker(b: Record<string, unknown>): Pick<Overlay, 'x' | 'y' | 'size' | 'can_resize' | 'can_rotate'> {
  const f = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
  return { x: f(b.x, 0, 1, 0.5), y: f(b.y, 0, 1, 0.3), size: f(b.size, 0.05, 1, 0.3), can_resize: b.can_resize !== false, can_rotate: b.can_rotate !== false };
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

/** A sticker's centre, width and turn on one photo, in pixels, from its fractions. */
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
