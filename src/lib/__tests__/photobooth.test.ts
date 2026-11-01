import { describe, expect, test } from 'vitest';
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
      mirror: false,
    });
    expect(c.layout).toBe('grid');
    expect(c.countdown).toBe(10);
    expect(c.keep_days).toBe(1);
    expect(c.qr_seconds).toBe(10);
    expect(c.strip_bg).toBe(DEFAULT_BOOTH.strip_bg); // not a colour: the default
    expect(c.accent).toBe('#abcdef');
    expect(c.footer).toHaveLength(80);
    expect(c.filter).toBe('none');
    expect(c.mirror).toBe(false);
  });
  test('prompts are cleaned and limited', () => {
    const c = cleanBooth({ prompts: ['  Pose!  ', '', 5, 'Silly!'] });
    expect(c.prompts).toEqual(['Pose!', 'Silly!']);
    expect(cleanBooth({ prompts: Array(20).fill('a') }).prompts).toHaveLength(6);
  });
  test('a sticker is kept inside its limits', () => {
    expect(cleanSticker({ x: 3, y: -1, size: 0, can_resize: false })).toEqual({ x: 1, y: 0, size: 0.05, can_resize: false, can_rotate: true });
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
