// A small software "camera" for the tests (not part of the app): draws a TGcode into a grey picture the way a phone might see it: any turn, size (in pixels), tilt,
// out-of-focus and motion blur, sensor noise, low contrast, a too-dark or too-bright exposure, glare, vignetting, a thumb over part of it, light or dark plate. Each pixel
// is the average of several sub-samples (as a real sensor averages the light that falls on it), so a code only a few dozen pixels wide is aliased like a real one.
import { DASH, R_IN, R_LOGO, RINGS, arcs, type Arc } from './layout';
import { DOTS, FINDERS, R_SMALL, U } from './marks';
import * as old from './legacyLayout';

export interface Shot {
  px: number;            // radius of the code in pixels (the plate is 2·px across)
  rot: number;           // turn, radians
  a?: number; b?: number;   // tilt (a perspective squeeze along x and y)
  blur?: number;         // out-of-focus blur, sigma in pixels
  motion?: number; motionAngle?: number;   // motion blur, length in pixels and direction
  noise?: number;        // sensor noise, standard deviation in grey levels
  contrast?: number;     // 1 = full, 0.4 = washed out
  brightness?: number;   // shift in grey levels (negative: under-exposed)
  gamma?: number;        // > 1 darkens the middle greys
  dark?: boolean;        // light marks on a dark plate (the portal's dark theme)
  glare?: boolean;
  vignette?: number;     // 0..1
  thumb?: { x: number; y: number; r: number };   // code units: a patch the plate shows nothing through
  tone?: boolean;        // legacy format only: the portal-blue second tone
  mono?: boolean;        // current format: every ring in the plain ink instead of its own colour
  seed?: number;
  size?: number;         // the picture's side (default: 2.6 × the radius)
  ss?: number;           // sub-samples per pixel side (default 3)
  margin?: number;       // centre offset, in code radii, so the code need not sit in the middle
}
export type Format = 'v2' | 'legacy';

// The message rings alternate the portal's ink and blue, and the filler arcs are Triton yellow and light blue, as grey (the dark theme draws the blue lighter).
const RING_GREY_LIGHT = [25, 63], RING_GREY_DARK = [236, 198], FILL_GREY = [198, 170];

/** The grey painting of a code: for a point in code units, the grey it has there. */
function makeInk(payload: string, format: Format, dark: boolean, tone: boolean, mono: boolean): (x: number, y: number) => number {
  const ink = dark ? 235 : 25, plate = dark ? 18 : 240, around = 128, rim = 200;
  const ringGrey = (ring: number, fill = false) => (fill ? FILL_GREY[ring % 2] : mono ? ink : (dark ? RING_GREY_DARK : RING_GREY_LIGHT)[ring % 2]);
  let arcAt: (x: number, y: number) => number;   // 0 none, else the grey of the dash there
  if (format === 'v2') {
    const rings: Arc[][] = Array.from({ length: RINGS }, () => []);
    for (const a of arcs(payload)) rings[a.ring].push(a);
    const thick = (0.88 - R_IN) / RINGS;
    arcAt = (x, y) => {
      const r = Math.hypot(x, y);
      if (r < R_IN - DASH || r >= 0.88 + DASH) return 0;
      const ring = Math.max(0, Math.min(RINGS - 1, Math.floor((r - R_IN) / thick)));
      const rc = R_IN + (ring + 0.5) * thick;
      if (Math.abs(r - rc) > DASH / 2) return 0;
      let ang = Math.atan2(y, x); if (ang < 0) ang += 2 * Math.PI;
      const cap = DASH / 2 / rc;   // the round ends: the middle line of an arc stops a cap's width short of each end
      let grey = 0;
      for (const a of rings[ring]) {
        if (a.a1 - a.a0 >= 2 * Math.PI) { grey = ringGrey(ring, a.fill); break; }
        for (const k of [-1, 0, 1]) {
          const t = ang + k * 2 * Math.PI;
          const lo = a.a0 + cap, hi = a.a1 - cap;
          let d: number;
          if (t >= lo && t <= hi) d = Math.abs(r - rc);
          else d = Math.hypot((t - (t < lo ? lo : hi)) * rc, r - rc);   // past the middle line's end: distance to its end point
          if (d <= DASH / 2) { grey = ringGrey(ring, a.fill); break; }
        }
        if (grey) break;
      }
      return grey;
    };
  } else {
    const grid = old.dashGrid(payload)!;
    const delta = (2 * Math.PI) / old.SECTORS;
    arcAt = (x, y) => {
      const r = Math.hypot(x, y);
      if (r < old.R_IN || r >= old.R_IN + old.RINGS * old.THICK) return 0;
      const ring = Math.floor((r - old.R_IN) / old.THICK);
      if (Math.abs(r - (old.R_IN + (ring + 0.5) * old.THICK)) > old.DASH / 2) return 0;
      let ang = Math.atan2(y, x); if (ang < 0) ang += 2 * Math.PI;
      const sec = Math.floor(ang / delta) % old.SECTORS;
      const fr = ang / delta - Math.floor(ang / delta);
      const on = (k: number) => grid[ring][(k + old.SECTORS) % old.SECTORS];
      const lit = on(sec) ? !((!on(sec - 1) && fr < -old.endShift(ring, sec, 0)) || (!on(sec + 1) && fr > 1 + old.endShift(ring, sec, 1)))
        : (on(sec + 1) && !on(sec) && fr > 1 - old.endShift(ring, sec + 1, 0)) || (on(sec - 1) && fr < old.endShift(ring, sec - 1, 1));
      return lit ? (tone && (sec * 7 + ring * 3) % 4 === 0 ? (dark ? 170 : 66) : ink) : 0;
    };
  }
  return (x, y) => {
    const r = Math.hypot(x, y);
    if (r > 1) return around;
    if (r > 0.96) return rim;
    for (const f of Object.values(FINDERS)) {
      const d = Math.hypot(x - f.x, y - f.y);
      if (d <= 1.5 * U || (d > 2.5 * U && d <= 3.5 * U)) return ink;
    }
    for (const d of Object.values(DOTS)) if (Math.hypot(x - d.x, y - d.y) <= R_SMALL) return ink;
    if (r < R_LOGO) return Math.hypot(x - 0.04, y + 0.03) < 0.12 ? 110 : plate;
    if (Math.abs(r - (R_LOGO + R_IN) / 2) < 0.006) return rim;
    const g = arcAt(x, y);
    if (g) return g;
    return plate;
  };
}

export function paint(payload: string, o: Shot, format: Format = 'v2'): { img: Uint8ClampedArray; size: number } {
  const size = o.size ?? Math.round(o.px * 2.6);
  const ss = o.ss ?? 3;
  const ink = makeInk(payload, format, !!o.dark, !!o.tone, !!o.mono);
  const cs = Math.cos(o.rot), sn = Math.sin(o.rot), c = size / 2;
  const mid = (o.dark ? 235 + 18 : 25 + 240) / 2;
  const gain = o.contrast ?? 1, shift = o.brightness ?? 0;
  const rnd = (() => { let s = (o.seed ?? 7) * 2654435761 >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const cx = c + (o.margin ?? 0) * o.px;
  const shade = (g: number) => {
    let v = (g - mid) * gain + mid + shift;
    if (o.gamma) v = 255 * Math.pow(Math.max(0, Math.min(255, v)) / 255, o.gamma);
    return v;
  };
  let img = new Float32Array(size * size);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let acc = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      let u = (px + (sx + 0.5) / ss - cx) / o.px, v = (py + (sy + 0.5) / ss - c) / o.px;
      const k = 1 + (o.a ?? 0) * u + (o.b ?? 0) * v;
      u /= k; v /= k;
      const x = u * cs + v * sn, y = -u * sn + v * cs;   // inverse of a turn by o.rot
      if (o.thumb && Math.hypot(x - o.thumb.x, y - o.thumb.y) < o.thumb.r) { acc += shade(70); continue; }
      acc += shade(ink(x, y));
    }
    let g = acc / (ss * ss);
    if (o.glare) g += 70 * Math.max(0, 1 - Math.hypot(px - size * 0.7, py - size * 0.3) / (size * 0.25));
    if (o.vignette) { const d = Math.hypot(px - c, py - c) / (size / 2); g *= 1 - o.vignette * d * d; }
    img[py * size + px] = g;
  }
  const convolve = (src: Float32Array, kernel: number[], dx: number, dy: number) => {
    const out = new Float32Array(src.length), n = (kernel.length - 1) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0;
      for (let i = -n; i <= n; i++) { const xx = Math.min(size - 1, Math.max(0, Math.round(x + i * dx))), yy = Math.min(size - 1, Math.max(0, Math.round(y + i * dy))); s += src[yy * size + xx] * kernel[i + n]; }
      out[y * size + x] = s;
    }
    return out;
  };
  if (o.blur) {
    const n = Math.ceil(o.blur * 3), k = Array.from({ length: 2 * n + 1 }, (_, i) => Math.exp(-((i - n) ** 2) / (2 * o.blur! ** 2)));
    const sum = k.reduce((a, b) => a + b, 0); const kn = k.map((v) => v / sum);
    img = convolve(convolve(img, kn, 1, 0), kn, 0, 1);
  }
  if (o.motion && o.motion > 1) {
    const n = Math.round(o.motion), k = new Array<number>(n).fill(1 / n), a = o.motionAngle ?? 0;
    const half = (n - 1) / 2;
    const out = new Float32Array(img.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0;
      for (let i = 0; i < n; i++) { const t = i - half; const xx = Math.min(size - 1, Math.max(0, Math.round(x + t * Math.cos(a)))), yy = Math.min(size - 1, Math.max(0, Math.round(y + t * Math.sin(a)))); s += img[yy * size + xx] * k[i]; }
      out[y * size + x] = s;
    }
    img = out;
  }
  const out = new Uint8ClampedArray(size * size);
  for (let i = 0; i < out.length; i++) out[i] = img[i] + (o.noise ? (rnd() + rnd() + rnd() + rnd() - 2) * 1.73 * o.noise : 0);
  return { img: out, size };
}
