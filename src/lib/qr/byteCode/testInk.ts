// The Bytecode as grey levels for the test camera (not part of the app): Byte's flat colours as greys, his lines and the message's bars in plum, the eyes and paws as drawn.
import { drawing, LINE_W, INNER_W, PATCH_H } from './layout';
import { FINDERS } from './marks';
import { REGIONS, EYES } from './byteArt';

export const GREY = { plum: 62, plate: 244, 2: 92, 3: 155, 4: 228, 5: 215, 6: 178, 7: 200 } as Record<string | number, number>;
const R = 1024; // raster of the flat colours (the same for every message)
const raster = new Uint8Array(R * R).fill(GREY.plate);
{
  const toPx = (v: number) => ((v + 1) / 2) * R;
  for (const reg of [...REGIONS, ...EYES]) {
    const loops = reg.d
      .split('M')
      .filter(Boolean)
      .map((l) =>
        l
          .replace('Z', '')
          .split('L')
          .map((p) => p.trim().split(' ').map(Number)),
      );
    for (let y = 0; y < R; y++) {
      const yy = ((y + 0.5) / R) * 2 - 1;
      const xs: number[] = [];
      for (const loop of loops)
        for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
          const [xi, yi] = loop[i],
            [xj, yj] = loop[j];
          if (yi > yy !== yj > yy) xs.push(xi + ((yy - yi) * (xj - xi)) / (yj - yi));
        }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.max(0, Math.ceil(toPx(xs[k]) - 0.5)); x < Math.min(R, toPx(xs[k + 1]) - 0.5); x++) raster[y * R + x] = GREY[reg.col];
    }
  }
}
type Seg = [number, number, number, number, number, number]; // x0 y0 x1 y1 half-width grey
const CELL = 0.05;
export function byteInk(payload: string, dark = false): (x: number, y: number) => number {
  const d = drawing(payload)!;
  const segs: Seg[] = [];
  const addAll = (lines: [number, number][][], w: number, grey: number) => {
    for (const l of lines) for (let i = 1; i < l.length; i++) segs.push([l[i - 1][0], l[i - 1][1], l[i][0], l[i][1], w / 2, grey]);
  };
  // on a dark screen the sticker's plate is dark and the outer lines (the edge: his outline, the border round him, and the dashes) are cream; his inner lines stay plum
  const EDGE = dark ? 242 : GREY.plum;
  addAll(d.inner, INNER_W, GREY.plum);
  addAll(d.edge, LINE_W, EDGE);
  addAll(d.lineBars, LINE_W, EDGE);
  const hash = new Map<string, Seg[]>();
  for (const s of segs) {
    const x0 = Math.floor((Math.min(s[0], s[2]) - s[4]) / CELL),
      x1 = Math.floor((Math.max(s[0], s[2]) + s[4]) / CELL),
      y0 = Math.floor((Math.min(s[1], s[3]) - s[4]) / CELL),
      y1 = Math.floor((Math.max(s[1], s[3]) + s[4]) / CELL);
    for (let a = x0; a <= x1; a++)
      for (let b = y0; b <= y1; b++) {
        const k = a + ',' + b;
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k)!.push(s);
      }
  }
  const onLine = (x: number, y: number) => {
    let hit = -1;
    for (const [x0, y0, x1, y1, h, g] of hash.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) ?? []) {
      const vx = x1 - x0,
        vy = y1 - y0;
      const t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(x - x0 - t * vx, y - y0 - t * vy) <= h) {
        if (g === GREY.plum) return g; // an inner line wins where two meet
        hit = g;
      }
    }
    return hit;
  };
  const flip = (g: number) => g;
  // the shade patches, as a mask over the same raster (1: a little lighter than what is under it, 2: a little darker)
  const patchMask = new Uint8Array(R * R);
  for (const q of d.patches) {
    const x0 = Math.floor(((q.x - PATCH_H + 1) / 2) * R),
      x1 = Math.ceil(((q.x + PATCH_H + 1) / 2) * R),
      y0 = Math.floor(((q.y - PATCH_H + 1) / 2) * R),
      y1 = Math.ceil(((q.y + PATCH_H + 1) / 2) * R);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) if (xx >= 0 && yy >= 0 && xx < R && yy < R) patchMask[yy * R + xx] = q.light ? 1 : 2;
  }
  const plate = dark ? 22 : GREY.plate;
  return (x, y) => {
    if (Math.abs(x) > 1 || Math.abs(y) > 1) return 128;
    const on = onLine(x, y);
    if (on >= 0) return on;
    const g0 = raster[Math.min(R - 1, Math.floor(((y + 1) / 2) * R)) * R + Math.min(R - 1, Math.floor(((x + 1) / 2) * R))];
    let g = g0 === GREY.plate ? plate : g0;
    const pm = patchMask[Math.min(R - 1, Math.floor(((y + 1) / 2) * R)) * R + Math.min(R - 1, Math.floor(((x + 1) / 2) * R))];
    if (pm === 1 && g0 !== GREY.plate) g += (255 - g) * 0.16;
    else if (pm === 2 && g0 !== GREY.plate) g -= (g - 42) * 0.16;
    // the soft green glow round his eyes (over the green and the mask, under the eyes themselves)
    if (g !== GREY[4])
      for (const f of Object.values(FINDERS)) if (Math.hypot(x - f.x, y - f.y) < 0.2) return flip(Math.round(g + (178 - g) * (1 - Math.hypot(x - f.x, y - f.y) / 0.2) * 0.9));
    return flip(g);
  };
}
