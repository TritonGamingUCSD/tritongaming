import { describe, expect, test } from 'vitest';
import { inScanCircle, scanArea } from './scanArea';
import { paint } from './tgCode/testCamera';
import { decodeTGcodeAt } from './tgCode/decode';

// A phone held upright: a 1280×720 camera (turned to 720×1280), shown full screen on a 390×844 page.
const video = { w: 720, h: 1280 },
  stage = { w: 390, h: 844 },
  viewport = { w: 390, h: 844 };

describe('where the Scan page looks', () => {
  const a = scanArea(video, stage, viewport);
  test('the circle and the square read are centred, and the square is a little bigger than the circle', () => {
    expect(a.cx).toBe(360);
    expect(a.cy).toBe(640);
    expect(a.side).toBeGreaterThan(a.circle * 2);
    expect(a.side).toBeLessThan(a.circle * 3.01);
    expect(a.side).toBeLessThanOrEqual(video.w);
  });
  test('a code in the circle counts; one at the edge of the picture, or far bigger than the circle, does not', () => {
    expect(inScanCircle(a, { x: 360, y: 640, r: a.circle })).toBe(true);
    expect(inScanCircle(a, { x: 360 + a.circle * 0.5, y: 640 - a.circle * 0.4, r: a.circle * 0.8 })).toBe(true);
    expect(inScanCircle(a, { x: 90, y: 200, r: a.circle * 0.5 })).toBe(false); // a code in a corner of the view
    expect(inScanCircle(a, { x: 360 + a.circle * 1.2, y: 640, r: a.circle * 0.6 })).toBe(false); // outside the circle
    expect(inScanCircle(a, { x: 360, y: 640, r: a.circle * 2 })).toBe(false); // a code that fills the whole view
    expect(inScanCircle(a, null)).toBe(true); // no position to judge by: let it through
  });
  test('digital zoom shrinks the circle in video pixels but keeps it in the middle', () => {
    const z2 = scanArea(video, stage, viewport, 2);
    expect(z2.circle).toBeCloseTo(a.circle / 2, 6);
    expect(z2.cx).toBe(360);
  });

  test('a TGcode held in the circle is read from the cropped square; a second one at the edge of the view is not even in it', () => {
    // A synthetic picture of the whole camera view: one code in the middle (as held in the circle) and another near a corner.
    const big = scanArea({ w: 1280, h: 720 }, { w: 1280, h: 720 }, { w: 1280, h: 720 }, 1); // a landscape view: the circle is 52% of the height
    const inner = paint('m0123456789ab', { px: big.circle * 0.95, rot: 0.4, seed: 2, ss: 2 });
    const other = paint('t00ffeeddccbb', { px: 70, rot: 1.0, seed: 3, ss: 2 });
    const W = 1280,
      H = 720,
      g = new Uint8ClampedArray(W * H).fill(150);
    const put = (pic: { img: Uint8ClampedArray; size: number }, ox: number, oy: number) => {
      for (let y = 0; y < pic.size; y++)
        for (let x = 0; x < pic.size; x++) {
          const X = ox + x,
            Y = oy + y;
          if (X >= 0 && Y >= 0 && X < W && Y < H) g[Y * W + X] = pic.img[y * pic.size + x];
        }
    };
    put(inner, Math.round(W / 2 - inner.size / 2), Math.round(H / 2 - inner.size / 2));
    put(other, 40, 30);
    // The crop the scanner takes: the square of `side` pixels in the middle.
    const L = Math.round(big.side),
      x0 = Math.round(W / 2 - L / 2),
      y0 = Math.round(H / 2 - L / 2);
    const crop = new Uint8ClampedArray(L * L);
    for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) crop[y * L + x] = g[(y0 + y) * W + x0 + x];
    const got = decodeTGcodeAt(crop, L, L);
    expect(got?.payload).toBe('m01234567');
    expect(inScanCircle(big, got && { x: x0 + got.spot.x, y: y0 + got.spot.y, r: got.spot.r })).toBe(true);
    // The code near the corner is outside the square altogether.
    expect(40 + other.size / 2 < x0).toBe(true);
    const full = decodeTGcodeAt(g, W, H); // (in the whole picture either could be found)
    expect(full).not.toBeNull();
  });
});
