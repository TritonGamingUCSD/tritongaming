// Auto-correct for the booth's pictures: a room's lighting is the usual reason a photo looks too dark, flat or tinted. From the picture itself it works out how to stretch its brightness, lift or lower its middle tones and even out a colour
// cast, each only as far as a safe limit and only as much as the booth's strength (0 to 100) allows. Plain functions on pixel arrays (the browser reads and writes them on a canvas).

/** One lookup table per colour: what each of the 256 values becomes. */
export interface Adjust {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
/** How bright the middle of a well-lit photo should be (0 to 1). */
const TARGET = 0.46;
/** The brightness range of a picture is never stretched into less than this many levels, so a flat or noisy picture is not blown up. */
const MIN_RANGE = 120;
/** The most a colour is raised or lowered to even out a cast. */
const MAX_GAIN = 0.1;

/** The correction for a picture (`rgba` is its pixels, four values each) at a strength from 0 (none: every value stays) to 100. */
export function adjustFor(rgba: ArrayLike<number>, strength: number): Adjust {
  const s = clamp(strength, 0, 100) / 100;
  const hist = new Float64Array(256);
  let n = 0;
  let sr = 0,
    sg = 0,
    sb = 0;
  for (let i = 0; i + 3 < rgba.length; i += 16) {
    // (every fourth pixel is plenty to judge a picture)
    const r = rgba[i],
      g = rgba[i + 1],
      b = rgba[i + 2];
    hist[Math.round(luma(r, g, b))]++;
    sr += r;
    sg += g;
    sb += b;
    n++;
  }
  const identity = () => Uint8Array.from({ length: 256 }, (_, i) => i);
  if (!n || s === 0) return { r: identity(), g: identity(), b: identity() };
  const at = (p: number) => {
    let acc = 0;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= p * n) return i;
    }
    return 255;
  };
  let lo = at(0.01),
    hi = at(0.99);
  if (hi - lo < MIN_RANGE) {
    const mid = (hi + lo) / 2;
    lo = Math.max(0, mid - MIN_RANGE / 2);
    hi = Math.min(255, mid + MIN_RANGE / 2);
  }
  lo *= s;
  hi = 255 - (255 - hi) * s;
  const stretch = (v: number) => clamp((v - lo) / Math.max(1, hi - lo), 0, 1);
  let mean = 0;
  for (let i = 0; i < 256; i++) mean += hist[i] * stretch(i);
  mean = clamp(mean / n, 0.02, 0.98);
  const gamma = 1 + (clamp(Math.log(TARGET) / Math.log(mean), 0.65, 1.5) - 1) * s;
  const avg = (sr + sg + sb) / 3;
  const gain = (c: number) => 1 + clamp(avg / Math.max(1, c) - 1, -MAX_GAIN, MAX_GAIN) * s;
  const table = (g: number) => Uint8Array.from({ length: 256 }, (_, i) => Math.round(clamp(Math.pow(stretch(i), gamma) * g, 0, 1) * 255));
  return { r: table(gain(sr)), g: table(gain(sg)), b: table(gain(sb)) };
}

/** Applies a correction to pixels in place. */
export function applyAdjust(rgba: Uint8ClampedArray, a: Adjust): void {
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    rgba[i] = a.r[rgba[i]];
    rgba[i + 1] = a.g[rgba[i + 1]];
    rgba[i + 2] = a.b[rgba[i + 2]];
  }
}
