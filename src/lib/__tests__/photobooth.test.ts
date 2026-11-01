import { describe, expect, test } from 'vitest';
import { GIF_TRIES, spread } from '@/lib/photobooth/gif';
import { playbackTicks } from '@/lib/photobooth/playback';
import {
  DEFAULT_BOOTH,
  DEFAULT_FRAME_SPEC,
  SHOTS,
  applyFilter,
  cellSize,
  cleanBooth,
  cleanFrameSpec,
  frameLayout,
  cleanSticker,
  cleanPlacements,
  copyPlacementToAll,
  withPlacement,
  composition,
  expiresAt,
  photoLink,
  promptFor,
  stickerBox,
} from '@/lib/photobooth/booth';
import { TOKEN, photoToken } from '@/lib/photobooth/token';

describe('booth settings', () => {
  test('nothing sent means the defaults', () => {
    expect(cleanBooth(undefined)).toEqual(DEFAULT_BOOTH);
    expect(cleanBooth('x')).toEqual(DEFAULT_BOOTH);
  });
  test('every field is brought into range', () => {
    const c = cleanBooth({
      layout: 'grid',
      countdown: 99,
      keep_days: 0,
      qr_seconds: 5,
      strip_bg: 'red',
      accent: '#ABCDEF',
      footer: 'x'.repeat(200),
      filter: 'sepia',
    });
    expect(c.layout).toBe('grid');
    expect(c.countdown).toBe(10);
    expect(c.keep_days).toBe(1);
    expect(c.qr_seconds).toBe(10);
    expect(c.strip_bg).toBe(DEFAULT_BOOTH.strip_bg); // not a colour: the default
    expect(c.accent).toBe('#abcdef');
    expect(c.footer).toHaveLength(80);
    expect(c.filter).toBe('none');
  });
  test('prompts are cleaned and limited', () => {
    const c = cleanBooth({ prompts: ['  Pose!  ', '', 5, 'Silly!'] });
    expect(c.prompts).toEqual(['Pose!', 'Silly!']);
    expect(cleanBooth({ prompts: Array(20).fill('a') }).prompts).toHaveLength(6);
  });
  test('a sticker is kept inside its limits', () => {
    const p = cleanSticker({ placements: [{ x: 3, y: -1, size: 0, rotation: 400 }] }).placements;
    expect(p[0]).toEqual({ x: 1, y: 0, size: 0.05, rotation: 180 });
    expect(p).toHaveLength(4);
    expect(p.slice(1)).toEqual([null, null, null]);
  });
  test('a new sticker waits on no photo', () => {
    expect(cleanSticker({ placements: [null, null] }).placements).toEqual([null, null, null, null]);
    expect(cleanSticker({}).placements).toEqual([null, null, null, null]);
  });
});

describe("a booth's frame", () => {
  test('nothing sent means the default frame', () => {
    expect(cleanFrameSpec(undefined)).toEqual(DEFAULT_FRAME_SPEC);
  });
  test('every field is brought into range and a logo must be a web address', () => {
    const f = cleanFrameSpec({ border: 'dotted', color: 'blue', width: 500, top: 'x'.repeat(90), logoUrl: 'javascript:alert(1)', logoSize: 0, logoSpot: 'middle' });
    expect(f.border).toBe(DEFAULT_FRAME_SPEC.border);
    expect(f.color).toBe(DEFAULT_FRAME_SPEC.color);
    expect(f.width).toBe(60);
    expect(f.top).toHaveLength(40);
    expect(f.logoUrl).toBe('');
    expect(f.logoSize).toBe(0.08);
    expect(f.logoX).toBe(DEFAULT_FRAME_SPEC.logoX);
    expect(cleanFrameSpec({ logoUrl: 'https://x.supabase.co/storage/v1/object/public/photobooth-overlays/a.webp' }).logoUrl).toContain('https://');
  });
  test('a frame saved with a named logo spot keeps its place, and moved words stay on the photo', () => {
    const f = cleanFrameSpec({ logoSpot: 'bottom-left', topX: 4, topY: -2, bottomY: null });
    expect([f.logoX, f.logoY]).toEqual([0.18, 0.88]);
    expect([f.topX, f.topY, f.bottomY]).toEqual([1, 0, null]);
  });
  test('the layout starts the words at their edges, keeps moved words inside the border, and only has a logo when there is one', () => {
    const spec = { ...DEFAULT_FRAME_SPEC, width: 20, top: 'Hi', bottom: 'There', logoUrl: 'https://x/y.webp' };
    const l = frameLayout(spec, 720, 960, 0.5);
    expect(l.top?.cy).toBeCloseTo(20 + (960 * 0.09) / 2);
    expect(l.bottom?.cy).toBeCloseTo(960 - 20 - (960 * 0.09) / 2);
    expect(l.logo).toMatchObject({ cx: 0.82 * 720, w: 0.2 * 720, h: 0.1 * 720 });
    expect(frameLayout({ ...spec, topY: 0 }, 720, 960, null).top?.cy).toBeCloseTo(20 + (960 * 0.09) / 2);
    expect(frameLayout({ ...spec, top: ' ' }, 720, 960, null).top).toBeNull();
    expect(frameLayout(spec, 720, 960, null).logo).toBeNull();
  });
});

describe('the finished picture', () => {
  test('a layout holds as many photos as it takes', () => {
    for (const [layout, n] of Object.entries(SHOTS)) expect(composition(layout as keyof typeof SHOTS, 'portrait', false).cells).toHaveLength(n);
  });
  test('a strip is one column and a grid is two, and nothing overlaps or leaves the picture', () => {
    const strip = composition('strip3', 'portrait', true);
    expect(new Set(strip.cells.map((c) => c.x)).size).toBe(1);
    const grid = composition('grid', 'square', true);
    expect(new Set(grid.cells.map((c) => c.x)).size).toBe(2);
    for (const comp of [strip, grid, composition('single', 'wide', false)]) {
      for (const c of comp.cells) {
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(comp.width);
        expect(c.y + c.h).toBeLessThanOrEqual(comp.footer.y);
      }
      expect(comp.footer.y + comp.footer.h).toBeLessThanOrEqual(comp.height);
      for (let i = 0; i < comp.cells.length; i++)
        for (let j = i + 1; j < comp.cells.length; j++) {
          const a = comp.cells[i],
            b = comp.cells[j];
          expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
        }
    }
  });
  test('the footer makes room only when there is text', () => {
    expect(composition('strip3', 'portrait', true).height).toBeGreaterThan(composition('strip3', 'portrait', false).height);
  });
  test('a photo has the shape of its aspect', () => {
    expect(cellSize('portrait').h / cellSize('portrait').w).toBeCloseTo(4 / 3);
    expect(cellSize('square').h).toBe(cellSize('square').w);
    expect(cellSize('wide').w / cellSize('wide').h).toBeCloseTo(4 / 3);
  });
  test('a sticker sits where its fractions say on its photo', () => {
    expect(stickerBox({ x: 100, y: 200, w: 400, h: 600 }, { x: 0.5, y: 0.25, size: 0.5 })).toEqual({ cx: 300, cy: 350, w: 200 });
  });
});

describe('prompts, links and expiry', () => {
  test('the prompts go in order and the last one repeats', () => {
    expect(promptFor([], 0)).toBe('');
    expect(promptFor(['a', 'b'], 0)).toBe('a');
    expect(promptFor(['a', 'b'], 5)).toBe('b');
  });
  test('the link and the expiry', () => {
    expect(photoLink('abc', 'https://tritongaming.org/')).toBe('https://tritongaming.org/photos/abc');
    expect(expiresAt(new Date('2026-10-31T00:00:00Z'), 7).toISOString()).toBe('2026-11-07T00:00:00.000Z');
  });
  test('tokens are 22 letters and digits and differ', () => {
    const a = photoToken(),
      b = photoToken();
    expect(a).toMatch(TOKEN);
    expect(a).not.toBe(b);
    let calls = 0;
    expect(photoToken((n) => new Uint8Array(n).fill(calls++ === 0 ? 255 : 7))).toMatch(TOKEN); // (the first batch is all rejected: it asks again)
  });
});

describe('filters', () => {
  test('black and white makes the three colours equal; natural changes nothing', () => {
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    applyFilter(px, 'bw');
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[3]).toBe(255);
    const same = new Uint8ClampedArray([1, 2, 3, 255]);
    applyFilter(same, 'none');
    expect([...same]).toEqual([1, 2, 3, 255]);
  });
  test('warm raises red and lowers blue', () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255]);
    applyFilter(px, 'warm');
    expect(px[0]).toBeGreaterThan(100);
    expect(px[2]).toBeLessThan(100);
  });
});

describe('deleting expired pictures', () => {
  test('removes the files and the rows that are past their time, and only those', async () => {
    const { cleanupPhotos } = await import('@/lib/photobooth/cleanup');
    const rows = [{ id: 'a', path: 'e/a.jpg', expires_at: '2026-10-30T00:00:00Z' }];
    const removedFiles: string[][] = [];
    const deletedIds: string[][] = [];
    let cutoff = '';
    const svc = {
      from: () => ({
        select: () => ({
          lte: (_col: string, at: string) => {
            cutoff = at;
            return { limit: async () => ({ data: rows.filter((r) => r.expires_at <= at) }) };
          },
        }),
        delete: () => ({ in: async (_c: string, ids: string[]) => void deletedIds.push(ids) }),
      }),
      storage: { from: () => ({ remove: async (paths: string[]) => void removedFiles.push(paths) }) },
    };
    const out = await cleanupPhotos(svc as never, new Date('2026-10-31T00:00:00Z'));
    expect(out).toEqual({ removed: 1 });
    expect(cutoff).toBe('2026-10-31T00:00:00.000Z');
    expect(removedFiles).toEqual([['e/a.jpg']]);
    expect(deletedIds).toEqual([['a']]);
    expect(await cleanupPhotos(svc as never, new Date('2026-10-29T00:00:00Z'))).toEqual({ removed: 0 });
  });
});

describe('animated strip frames', () => {
  test('keeps every frame when there are not more than asked for', () => {
    expect(spread([1, 2, 3], 5)).toEqual([1, 2, 3]);
  });
  test('spreads the kept frames evenly, first and last included', () => {
    const all = Array.from({ length: 16 }, (_, i) => i);
    const kept = spread(all, 8);
    expect(kept).toHaveLength(8);
    expect(kept[0]).toBe(0);
    expect(kept[7]).toBe(15);
  });
  test('tries smaller strips after bigger ones', () => {
    const widths = GIF_TRIES.map(([w]) => w);
    expect([...widths].sort((a, b) => b - a)).toEqual(widths);
  });
});

describe('stickers on each photo', () => {
  const at = (x: number) => ({ x, y: 0.5, size: 0.4, rotation: 0 });
  test('each photo keeps its own place', () => {
    const p = withPlacement([at(0.2), at(0.2), null, null], 1, at(0.8));
    expect(p[0]?.x).toBe(0.2);
    expect(p[1]?.x).toBe(0.8);
  });
  test('a photo can be left off', () => {
    expect(withPlacement([at(0.2), at(0.2), null, null], 1, null)[1]).toBeNull();
    expect(withPlacement([at(0.2), null, null, null], 0, null).every((q) => q === null)).toBe(true);
  });
  test("one photo's place can be copied to all the layout's photos", () => {
    const p = copyPlacementToAll([at(0.2), at(0.7), null, null], 1, 3);
    expect(p.map((q) => q?.x)).toEqual([0.7, 0.7, 0.7, undefined]);
  });
  test('placements are cleaned to 4 entries', () => {
    expect(cleanPlacements([at(0.1)])).toHaveLength(4);
    expect(cleanPlacements('nonsense')).toEqual([null, null, null, null]);
  });
});

describe('strip playback', () => {
  test('each photo plays and freezes in turn, then all play together and freeze', () => {
    const ticks = playbackTicks(3, 5, 2, 3);
    expect(ticks[0]).toEqual([0, 0, 0]); // photo 1 starts, the others wait on their first moment
    expect(ticks[4]).toEqual([4, 0, 0]); // photo 1 reaches its shot
    expect(ticks[5]).toEqual([4, 0, 0]); // and holds
    expect(ticks[7]).toEqual([4, 0, 0]); // photo 2 begins with photo 1 frozen on its shot
    expect(ticks[7 + 0]).toEqual([4, 0, 0]);
    expect(ticks[8]).toEqual([4, 1, 0]);
    const together = ticks.slice(3 * 7);
    expect(together[0]).toEqual([0, 0, 0]);
    expect(together[4]).toEqual([4, 4, 4]);
    expect(together.at(-1)).toEqual([4, 4, 4]);
    expect(ticks).toHaveLength(3 * 7 + 5 + 3);
  });
  test('one photo only plays together', () => {
    expect(playbackTicks(1, 4, 2, 2)).toEqual([[0], [1], [2], [3], [3], [3]]);
  });
});
