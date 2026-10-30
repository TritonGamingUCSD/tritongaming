import { describe, expect, test } from 'vitest';
import { inView, scanArea } from './scanArea';
import { readFrame } from './scanFrame';
import { paint } from './tgCode/testCamera';

// A phone held upright: a 1280×720 camera (turned to 720×1280), shown full screen on a 390×844 page.
const video = { w: 720, h: 1280 },
  stage = { w: 390, h: 844 };

describe('where the Scan page looks', () => {
  test('all of what is on the screen: the picture fills the stage with its middle kept, so the sides are cut', () => {
    const a = scanArea(video, stage);
    expect(a.h).toBe(1280); // the full height is on the screen
    expect(a.w).toBeCloseTo(390 / (844 / 1280), 3); // and the width the stage's shape allows
    expect(a.x).toBeCloseTo((720 - a.w) / 2, 6);
    expect(a.y).toBe(0);
  });
  test('digital zoom shows a smaller part, still round the middle', () => {
    const a = scanArea(video, stage, 2);
    expect(a.w).toBeCloseTo(scanArea(video, stage).w / 2, 6);
    expect(a.h).toBeCloseTo(640, 6);
    expect(a.x + a.w / 2).toBeCloseTo(360, 6);
    expect(a.y + a.h / 2).toBeCloseTo(640, 6);
  });
  test('a code anywhere on the screen is in view; one in the part the screen cuts off is not', () => {
    const a = scanArea(video, stage);
    expect(inView(a, { x: a.x + 10, y: 10 })).toBe(true); // a corner of the view
    expect(inView(a, { x: 360, y: 640 })).toBe(true);
    expect(inView(a, { x: a.x - 20, y: 640 })).toBe(false); // off the screen at the side
    expect(inView(a, null)).toBe(true);
  });
});

// A grey picture of the whole view with codes placed in it, as the RGBA the scanner reads.
function view(W: number, H: number, codes: { payload: string; px: number; x: number; y: number; rot: number }[]) {
  const g = new Uint8ClampedArray(W * H).fill(128);
  for (const c of codes) {
    const p = paint(c.payload, { px: c.px, rot: c.rot, seed: 2, ss: 2, size: Math.round(c.px * 2.4) });
    const x0 = Math.round(c.x - p.size / 2),
      y0 = Math.round(c.y - p.size / 2);
    for (let y = 0; y < p.size; y++) for (let x = 0; x < p.size; x++) if (x0 + x >= 0 && x0 + x < W && y0 + y >= 0 && y0 + y < H) g[(y0 + y) * W + x0 + x] = p.img[y * p.size + x];
  }
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < g.length; i++) rgba.set([g[i], g[i], g[i], 255], i * 4);
  return rgba;
}

describe('reading anywhere in the view', () => {
  const W = 540,
    H = 960,
    geo = { k: 2, ox: 100, oy: 50 };
  test('a code in a corner of the view is read, and its position comes back in video pixels', () => {
    const got = readFrame(view(W, H, [{ payload: 'm0123456789ab', px: 90, x: 110, y: 150, rot: 0.4 }]), W, H, geo);
    expect(got?.text).toBe('tg:m01234567'); // (a code carries the first 8 digits of its key)
    expect(got!.found.x).toBeCloseTo(100 + 110 * 2, -1); // within ~10 video pixels
    expect(got!.found.y).toBeCloseTo(50 + 150 * 2, -1);
  });
  test('with two codes in view, the one near the middle is read', () => {
    const got = readFrame(
      view(W, H, [
        { payload: 't00ffeeddccbb', px: 85, x: 120, y: 160, rot: 1.0 },
        { payload: 'r1f2e3d4c5b6a', px: 85, x: 270, y: 480, rot: 0.2 },
      ]),
      W,
      H,
      geo,
    );
    expect(got?.text).toBe('tg:r1f2e3d4c');
  });
  test('nothing in view: nothing is read', () => {
    expect(readFrame(view(W, H, []), W, H, geo)).toBeNull();
  });
});
