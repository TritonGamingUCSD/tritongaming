import { DEFAULT_FRAME_SPEC, WORDS_SIZE, cellSize, frameLayout, type Aspect, type FrameSpec } from '@/lib/photobooth/booth';

// Drawing a frame or a text sticker on the website, so nobody has to make a picture of exactly the right shape in another program. Browser only (it draws on a canvas); the result is a see-through
// WebP that goes into the overlay library like any other.
export interface FrameDesign extends FrameSpec {
  aspect: Aspect;
  /** The logo, loaded (its address is in `logoUrl`). */
  logo: HTMLImageElement | null;
}

export const DEFAULT_FRAME: FrameDesign = { ...DEFAULT_FRAME_SPEC, aspect: 'portrait', logo: null };

/** The starting height of a line of words, as a fraction of the photo's height. */
export const BAND = WORDS_SIZE;

const FONT = '"Futura", "Avenir Next", system-ui, sans-serif';

/** The largest font size (down to `min`) at which `text` fits in `max` pixels, given a function that measures it. Pure. */
export function fitFont(measure: (size: number) => number, max: number, start: number, min = 14): number {
  let size = start;
  while (size > min && measure(size) > max) size -= 2;
  return size;
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, r: number) {
  // the border: everything inside the outer rectangle except the inner (rounded) rectangle
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.roundRect(x + t, y + t, w - 2 * t, h - 2 * t, r);
  ctx.fill('evenodd');
}

/** Draws a frame design on a canvas of the photo's size. */
export function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, d: FrameDesign): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = d.color;
  const t = d.border === 'none' ? 0 : d.width;
  if (d.border === 'solid') ring(ctx, 0, 0, w, h, t, 0);
  if (d.border === 'rounded') ring(ctx, 0, 0, w, h, t, 34);
  if (d.border === 'double') {
    ring(ctx, 0, 0, w, h, t * 0.55, 0);
    ring(ctx, t * 0.95, t * 0.95, w - t * 1.9, h - t * 1.9, t * 0.3, 0);
  }
  const lay = frameLayout(d, w, h, d.logo ? d.logo.naturalHeight / Math.max(1, d.logo.naturalWidth) : null);
  const words = (text: string, p: (typeof lay)['top']) => {
    if (!p) return;
    ctx.fillStyle = d.band;
    ctx.fillRect(t, p.cy - p.h / 2, p.w, p.h);
    ctx.fillStyle = d.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = fitFont((s) => ((ctx.font = `700 ${s}px ${FONT}`), ctx.measureText(text).width), p.w - 40, p.h * 0.62);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillText(text, p.x, p.y + 2);
  };
  words(d.top, lay.top);
  words(d.bottom, lay.bottom);
  if (d.logo && lay.logo) ctx.drawImage(d.logo, lay.logo.cx - lay.logo.w / 2, lay.logo.cy - lay.logo.h / 2, lay.logo.w, lay.logo.h);
}

/** The finished frame as a WebP file (see-through where the photo shows). */
export function renderFrame(d: FrameDesign): Promise<Blob | null> {
  const { w, h } = cellSize(d.aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawFrame(canvas.getContext('2d')!, w, h, d);
  return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.92));
}

export interface TextSticker {
  text: string;
  color: string;
  outline: string;
  pill: string; // the colour of a rounded plate behind the words, or '' for none
}
export const DEFAULT_TEXT_STICKER: TextSticker = { text: '#TritonGaming', color: '#ffffff', outline: '#011941', pill: '' };

/** Draws words as a sticker: big, outlined, on an optional rounded plate, on a canvas 900 wide. */
export function drawTextSticker(canvas: HTMLCanvasElement, s: TextSticker): void {
  const ctx = canvas.getContext('2d')!;
  const W = 900,
    H = 280;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  const text = s.text.trim() || ' ';
  const size = fitFont((px) => ((ctx.font = `800 ${px}px ${FONT}`), ctx.measureText(text).width), W - 140, 170, 40);
  ctx.font = `800 ${size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  if (s.pill) {
    ctx.fillStyle = s.pill;
    ctx.beginPath();
    ctx.roundRect((W - tw) / 2 - 50, H / 2 - size * 0.62, tw + 100, size * 1.24, size * 0.62);
    ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(8, size * 0.1);
  ctx.strokeStyle = s.outline;
  ctx.strokeText(text, W / 2, H / 2 + 4);
  ctx.fillStyle = s.color;
  ctx.fillText(text, W / 2, H / 2 + 4);
}

export function renderTextSticker(s: TextSticker): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  drawTextSticker(canvas, s);
  return new Promise((res) => canvas.toBlob(res, 'image/webp', 0.92));
}
