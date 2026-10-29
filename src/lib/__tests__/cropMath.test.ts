import { describe, expect, it } from 'vitest';
import { dragCrop, fitAspect, isWhole, startRect, toSource, type Handle, type Rect } from '@/lib/ui/cropMath';

const BW = 400,
  BH = 300;
const inside = (r: Rect) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= BW + 1e-6 && r.y + r.h <= BH + 1e-6;
const HANDLES: Handle[] = ['move', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

describe('crop box', () => {
  it('starts as the whole picture, or the biggest box of a ratio in the middle', () => {
    expect(startRect(BW, BH, null)).toEqual({ x: 0, y: 0, w: 400, h: 300 });
    expect(startRect(BW, BH, 1)).toEqual({ x: 50, y: 0, w: 300, h: 300 });
    const wide = startRect(BW, BH, 16 / 9);
    expect(wide.w).toBe(400);
    expect(wide.w / wide.h).toBeCloseTo(16 / 9);
    expect(inside(wide)).toBe(true);
  });
  it('moves, and never leaves the picture', () => {
    const r = { x: 100, y: 100, w: 100, h: 80 };
    expect(dragCrop(r, 'move', 30, -20, BW, BH, null)).toEqual({ x: 130, y: 80, w: 100, h: 80 });
    expect(dragCrop(r, 'move', 9999, 9999, BW, BH, null)).toEqual({ x: 300, y: 220, w: 100, h: 80 });
    expect(dragCrop(r, 'move', -9999, -9999, BW, BH, null)).toEqual({ x: 0, y: 0, w: 100, h: 80 });
  });
  it('resizes from a side, keeping the opposite side still', () => {
    const r = { x: 100, y: 100, w: 100, h: 80 };
    expect(dragCrop(r, 'e', 50, 0, BW, BH, null)).toEqual({ x: 100, y: 100, w: 150, h: 80 });
    expect(dragCrop(r, 'w', -40, 0, BW, BH, null)).toEqual({ x: 60, y: 100, w: 140, h: 80 });
    expect(dragCrop(r, 's', 0, 30, BW, BH, null)).toEqual({ x: 100, y: 100, w: 100, h: 110 });
    expect(dragCrop(r, 'nw', -30, -20, BW, BH, null)).toEqual({ x: 70, y: 80, w: 130, h: 100 });
  });
  it('never gets smaller than the minimum or bigger than the picture', () => {
    const r = { x: 100, y: 100, w: 100, h: 80 };
    expect(dragCrop(r, 'e', -9999, 0, BW, BH, null, 24).w).toBe(24);
    expect(dragCrop(r, 'se', 9999, 9999, BW, BH, null)).toEqual({ x: 100, y: 100, w: 300, h: 200 });
    expect(dragCrop(r, 'nw', -9999, -9999, BW, BH, null)).toEqual({ x: 0, y: 0, w: 200, h: 180 });
  });
  it('holds a ratio from every handle and stays inside', () => {
    for (const aspect of [1, 4 / 3, 16 / 9, 3 / 4]) {
      const start = startRect(BW, BH, aspect);
      const r = { ...start, w: start.w * 0.6, h: start.h * 0.6, x: 120, y: 90 };
      for (const handle of HANDLES.filter((h) => h !== 'move')) {
        for (const [dx, dy] of [
          [40, 25],
          [-60, -45],
          [500, 500],
          [-500, -500],
          [0, 70],
          [70, 0],
        ]) {
          const out = dragCrop(r, handle, dx, dy, BW, BH, aspect);
          expect(out.w / out.h, `${handle} ${aspect} ${dx},${dy}`).toBeCloseTo(aspect, 5);
          expect(inside(out), `${handle} ${aspect} ${dx},${dy} -> ${JSON.stringify(out)}`).toBe(true);
          expect(out.w).toBeGreaterThanOrEqual(23.99);
        }
      }
    }
  });
  it('fits a chosen ratio into the box it is on', () => {
    const r = fitAspect({ x: 20, y: 30, w: 300, h: 200 }, 1, BW, BH);
    expect(r.w).toBe(200);
    expect(r.h).toBe(200);
    expect(r.x).toBe(70);
    expect(inside(r)).toBe(true);
  });
  it('turns the box into the picture’s own pixels', () => {
    expect(toSource({ x: 100, y: 75, w: 200, h: 150 }, 400, 300, 2000, 1500)).toEqual({ sx: 500, sy: 375, sw: 1000, sh: 750 });
    const edge = toSource({ x: 399, y: 299, w: 50, h: 50 }, 400, 300, 2000, 1500);
    expect(edge.sx + edge.sw).toBeLessThanOrEqual(2000);
    expect(edge.sy + edge.sh).toBeLessThanOrEqual(1500);
  });
  it('knows when nothing is cropped', () => {
    expect(isWhole({ x: 0, y: 0, w: 400, h: 300 }, BW, BH)).toBe(true);
    expect(isWhole({ x: 0, y: 0, w: 350, h: 300 }, BW, BH)).toBe(false);
  });
});
