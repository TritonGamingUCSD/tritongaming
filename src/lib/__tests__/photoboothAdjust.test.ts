import { describe, expect, test } from 'vitest';
import { adjustFor, applyAdjust } from '@/lib/photobooth/adjust';

const flat = (r: number, g: number, b: number, count = 400): Uint8ClampedArray => Uint8ClampedArray.from({ length: count * 4 }, (_, i) => [r, g, b, 255][i % 4]);
/** A picture whose brightness runs from `from` to `to` (grey). */
const ramp = (from: number, to: number, count = 400): Uint8ClampedArray =>
  Uint8ClampedArray.from({ length: count * 4 }, (_, i) => (i % 4 === 3 ? 255 : Math.round(from + ((to - from) * Math.floor(i / 4)) / (count - 1))));
const mean = (px: Uint8ClampedArray) => {
  let t = 0;
  for (let i = 0; i < px.length; i += 4) t += px[i];
  return t / (px.length / 4);
};

describe('auto-correct', () => {
  test('strength 0 changes nothing', () => {
    const px = ramp(10, 120);
    const before = Uint8ClampedArray.from(px);
    applyAdjust(px, adjustFor(px, 0));
    expect([...px]).toEqual([...before]);
  });
  test('a dark picture gets brighter', () => {
    const px = ramp(5, 90);
    const was = mean(px);
    applyAdjust(px, adjustFor(px, 100));
    expect(mean(px)).toBeGreaterThan(was + 20);
  });
  test('a washed-out bright picture gets darker', () => {
    const px = ramp(150, 255);
    const was = mean(px);
    applyAdjust(px, adjustFor(px, 100));
    expect(mean(px)).toBeLessThan(was - 15);
  });
  test('a well-lit picture hardly moves', () => {
    const px = ramp(20, 235);
    const was = mean(px);
    applyAdjust(px, adjustFor(px, 100));
    expect(Math.abs(mean(px) - was)).toBeLessThan(18);
  });
  test('a lower strength moves less than a higher one', () => {
    const a = ramp(5, 90),
      b = ramp(5, 90);
    applyAdjust(a, adjustFor(a, 30));
    applyAdjust(b, adjustFor(b, 100));
    expect(mean(a)).toBeLessThan(mean(b));
  });
  test('a colour cast is evened out, but only a little', () => {
    const px = flat(160, 120, 100); // warm
    const t = adjustFor(px, 100);
    // red is pulled down and blue is lifted relative to each other, by no more than 10 percent
    const r = t.r[128] / 128,
      b = t.b[128] / 128;
    expect(r).toBeLessThanOrEqual(b);
    expect(b / r).toBeLessThan(1.25);
  });
  test('alpha is left alone', () => {
    const px = ramp(5, 90);
    applyAdjust(px, adjustFor(px, 100));
    expect(px[3]).toBe(255);
  });
});
