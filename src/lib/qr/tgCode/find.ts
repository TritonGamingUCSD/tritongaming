import { SPAN, U } from './marks';

// What every TGcode reader shares: finding the two ring marks and the two dots in a grey picture, and straightening what they show.

export interface Finder {
  x: number;
  y: number;
  u: number;
}

const near = (run: number, expect: number, tol: number) => Math.abs(run - expect) <= tol;
// dark, light, dark(wide), light, dark in the ratio 1:1:3:1:1
function ratio11311(r: number[]): number {
  const total = r[0] + r[1] + r[2] + r[3] + r[4];
  const u = total / 7;
  const t = u * 0.7;
  return near(r[0], u, t) && near(r[1], u, t) && near(r[2], 3 * u, 3 * t * 0.9) && near(r[3], u, t) && near(r[4], u, t) ? u : 0;
}

function verticalCheck(bin: Uint8Array, w: number, h: number, x: number, y: number, u: number): { y: number; u: number } | null {
  const at = (yy: number) => bin[yy * w + x];
  let up = y;
  while (up >= 0 && at(up) === 1) up--; // centre dark run, upwards
  let down = y;
  while (down < h && at(down) === 1) down++;
  if (up < 0 || down >= h) return null;
  const c = down - up - 1;
  let u1 = up;
  while (u1 >= 0 && at(u1) === 0) u1--;
  let d1 = down;
  while (d1 < h && at(d1) === 0) d1++;
  if (u1 < 0 || d1 >= h) return null;
  const l1 = up - u1,
    l2 = d1 - down;
  let u2 = u1;
  while (u2 >= 0 && at(u2) === 1) u2--;
  let d2 = d1;
  while (d2 < h && at(d2) === 1) d2++;
  const r0 = u1 - u2,
    r4 = d2 - d1;
  const uu = ratio11311([r0, l1, c, l2, r4]);
  if (!uu || Math.abs(uu - u) > u * 0.6) return null;
  return { y: (up + 1 + down - 1) / 2, u: uu };
}

export function findFinders(bin: Uint8Array, w: number, h: number): Finder[] {
  const cands: Finder[] = [];
  for (let y = 0; y < h; y++) {
    const runs: number[] = [],
      starts: number[] = [],
      colors: number[] = [];
    let x = 0;
    while (x < w) {
      const c = bin[y * w + x];
      let e = x;
      while (e < w && bin[y * w + e] === c) e++;
      starts.push(x);
      runs.push(e - x);
      colors.push(c);
      x = e;
    }
    for (let i = 0; i + 4 < runs.length; i++) {
      if (colors[i] !== 1) continue;
      const u = ratio11311(runs.slice(i, i + 5));
      if (!u || u < 1.2) continue;
      const cx = starts[i + 2] + (runs[i + 2] - 1) / 2;
      const v = verticalCheck(bin, w, h, Math.floor(cx), y, u);
      if (v) cands.push({ x: cx, y: v.y, u: (u + v.u) / 2 });
    }
  }
  // Merge the hits of one mark (many rows) into its centre.
  const clusters: { x: number; y: number; u: number; n: number }[] = [];
  for (const c of cands) {
    const hit = clusters.find((k) => Math.hypot(k.x - c.x, k.y - c.y) < Math.max(2, c.u * 1.5));
    if (hit) {
      hit.x = (hit.x * hit.n + c.x) / (hit.n + 1);
      hit.y = (hit.y * hit.n + c.y) / (hit.n + 1);
      hit.u = (hit.u * hit.n + c.u) / (hit.n + 1);
      hit.n++;
    } else clusters.push({ ...c, n: 1 });
  }
  return clusters.filter((k) => k.n >= 2).map(({ x, y, u }) => ({ x, y, u }));
}

/** Pairs of ring marks that could be the top-left and top-right ones (similar size, the right distance apart), best first. */
export function pickPairs(all: Finder[]): [Finder, Finder][] {
  // The marks are the biggest things that look like a 1:1:3:1:1 pattern; the many small look-alikes that fine detail makes in a big picture are left out.
  const umax = Math.max(0, ...all.map((k) => k.u));
  const f = all.length > 8 ? all.filter((k) => k.u >= umax * 0.6) : all; // (only when there are a lot of them)
  const out: { pair: [Finder, Finder]; score: number }[] = [];
  for (let a = 0; a < f.length; a++)
    for (let b = a + 1; b < f.length; b++) {
      const A = f[a],
        B = f[b],
        um = (A.u + B.u) / 2;
      if (Math.max(A.u, B.u) > um * 1.25 || Math.min(A.u, B.u) < um * 0.8) continue;
      const units = Math.hypot(B.x - A.x, B.y - A.y) / um / (SPAN / U);
      if (units < 0.75 || units > 1.3) continue;
      out.push({ pair: [A, B], score: Math.abs(units - 1) });
    }
  return out
    .sort((p, q) => p.score - q.score)
    .slice(0, 4)
    .map((p) => p.pair);
}

/** The centre of the solid round blob of marks (a dot of about `radius` pixels) nearest to `near`, or null. Every blob in reach is looked at, so a dash or a smudge close by cannot hide it. */
export function findDot(bin: Uint8Array, w: number, h: number, near: { x: number; y: number }, radius: number): { x: number; y: number } | null {
  return findDots(bin, w, h, near, radius, Math.max(6, radius * 7), false)[0] ?? null; // (the first format's way: nearest solid round blob)
}

/** Every dot-like blob within `reach` of `near`, the likeliest (nearest, and the clearest of ink around it) first. */
export function findDots(bin: Uint8Array, w: number, h: number, near: { x: number; y: number }, radius: number, reach: number, tilted = true): { x: number; y: number }[] {
  const found: { x: number; y: number; score: number }[] = [];
  const disc = Math.PI * radius * radius;
  const seen = new Set<number>();
  for (let y0 = Math.max(0, Math.floor(near.y - reach)); y0 <= Math.min(h - 1, Math.ceil(near.y + reach)); y0++)
    for (let x0 = Math.max(0, Math.floor(near.x - reach)); x0 <= Math.min(w - 1, Math.ceil(near.x + reach)); x0++) {
      const start = y0 * w + x0;
      if (!bin[start] || seen.has(start)) continue;
      seen.add(start);
      const queue = [start];
      let n = 0,
        sumX = 0,
        sumY = 0,
        minX = w,
        maxX = 0,
        minY = h,
        maxY = 0,
        tooBig = false;
      while (queue.length) {
        const i = queue.pop()!;
        const x = i % w,
          y = (i - x) / w;
        n++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (n > disc * 2.2 + 20) {
          tooBig = true;
        }
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !bin[ny * w + nx]) continue;
          const k = ny * w + nx;
          if (!seen.has(k)) {
            seen.add(k);
            if (!tooBig) queue.push(k);
          }
        }
      }
      if (tooBig) continue;
      const bw = maxX - minX + 1,
        bh = maxY - minY + 1;
      if (
        tilted
          ? n < disc * 0.45 || n > disc * 2.4 || bw / bh < 0.62 || bw / bh > 1.6 || n < bw * bh * 0.62
          : n < disc * 0.55 || n > disc * 2 || bw / bh < 0.72 || bw / bh > 1.4 || n < bw * bh * 0.66
      )
        continue; // a solid round blob, not a dash (a tilted code squeezes it, so not too strict)
      const cx = sumX / n,
        cy = sumY / n,
        d = Math.hypot(cx - near.x, cy - near.y);
      // A dot has clear plate all round it (no cell comes near it); a bit of an arc that happens to look round does not. Blobs with ink around them count as farther away.
      const rr = Math.sqrt(n / Math.PI) * 1.9;
      let inked = 0;
      for (let k = 0; k < 16; k++) {
        const a = (k * Math.PI) / 8,
          px = Math.round(cx + rr * Math.cos(a)),
          py = Math.round(cy + rr * Math.sin(a));
        if (px >= 0 && py >= 0 && px < w && py < h && bin[py * w + px]) inked++;
      }
      const score = tilted ? d * (1 + 0.5 * inked) : d;
      found.push({ x: cx, y: cy, score });
    }
  return found.sort((p, q) => p.score - q.score).map(({ x, y }) => ({ x, y }));
}

/** Solves the 3×3 projective map that takes four code points to four picture points (null when they do not allow one). */
export function homography(src: { x: number; y: number }[], dst: { x: number; y: number }[]): ((x: number, y: number) => { x: number; y: number }) | null {
  const M: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i],
      { x: u, y: v } = dst[i];
    M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    M.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < 8; r++)
      if (r !== c) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k < 9; k++) M[r][k] -= f * M[c][k];
      }
  }
  const h = M.map((row, i) => row[8] / row[i]);
  return (x, y) => {
    const d = h[6] * x + h[7] * y + 1;
    return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
  };
}

/** Black-or-white by comparing each pixel with the average around it, so a plate of any brightness, in any light, against any background, reads the same. */
export function binarize(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, darkMarks: boolean): Uint8Array {
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.min(w, h) * 0.09));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const g = gray[y * w + x];
      bin[y * w + x] = (darkMarks ? g < mean - 10 : g > mean + 10) ? 1 : 0;
    }
  }
  return bin;
}
