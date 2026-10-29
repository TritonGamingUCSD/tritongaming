import { type Finder, binarize } from '../tgCode/find';
import { EYE_SHAPES } from './byteArt';
import { SPAN } from './marks';

// Finds Byte's two eyes in a grey picture: pale shapes on his green head. The left one is a long thin pill and the right one a cross, so a pair is only taken when its two blobs have
// those shapes and the sizes they should have at the distance they are apart. The pill is returned first (it is the code's left mark).
interface Blob {
  x: number;
  y: number;
  n: number;
  rmax: number;
  elong: number; // how much longer than wide (1: round)
  fill: number; // share of the circle that reaches the farthest point which the blob fills (a cross fills little)
}

export function blobs(bin: Uint8Array, w: number, h: number): Blob[] {
  const seen = new Uint8Array(w * h);
  const out: Blob[] = [];
  const stack: number[] = [];
  const maxN = w * h * 0.06;
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || seen[s]) continue;
    const pix: number[] = [];
    seen[s] = 1;
    stack.push(s);
    let big = false;
    while (stack.length) {
      const i = stack.pop()!;
      if (pix.length > maxN) {
        big = true;
        continue;
      }
      pix.push(i);
      const x = i % w,
        y = (i - x) / w;
      if (x > 0 && bin[i - 1] && !seen[i - 1]) ((seen[i - 1] = 1), stack.push(i - 1));
      if (x < w - 1 && bin[i + 1] && !seen[i + 1]) ((seen[i + 1] = 1), stack.push(i + 1));
      if (y > 0 && bin[i - w] && !seen[i - w]) ((seen[i - w] = 1), stack.push(i - w));
      if (y < h - 1 && bin[i + w] && !seen[i + w]) ((seen[i + w] = 1), stack.push(i + w));
    }
    if (big || pix.length < 12) continue;
    let sx = 0,
      sy = 0;
    for (const i of pix) {
      sx += i % w;
      sy += Math.floor(i / w);
    }
    const n = pix.length,
      cx = sx / n,
      cy = sy / n;
    let mxx = 0,
      myy = 0,
      mxy = 0,
      rmax = 0;
    for (const i of pix) {
      const dx = (i % w) - cx,
        dy = Math.floor(i / w) - cy;
      mxx += dx * dx;
      myy += dy * dy;
      mxy += dx * dy;
      rmax = Math.max(rmax, Math.hypot(dx, dy));
    }
    mxx /= n;
    myy /= n;
    mxy /= n;
    const tr = mxx + myy,
      d = Math.sqrt(Math.max(0, ((mxx - myy) * (mxx - myy)) / 4 + mxy * mxy));
    out.push({ x: cx, y: cy, n, rmax, elong: Math.sqrt((tr / 2 + d) / Math.max(1e-6, tr / 2 - d)), fill: n / (Math.PI * rmax * rmax) });
  }
  return out;
}

const close = (got: number, want: number, tol: number) => Math.abs(got / want - 1) <= tol;

/** Pairs of blobs that could be Byte's pill eye and X eye (best first), as a left and a right mark. */
export function findEyes(gray: Uint8ClampedArray | Uint8Array, w: number, h: number): [Finder, Finder][] {
  // The eyes are the palest things on his green head, with a softer glow round them: ask for a lot of contrast first (so the glow is not part of them), then less in a poor light.
  for (const bias of [40, 25, 14]) {
    const found = pairsIn(blobs(binarize(gray, w, h, false, bias), w, h));
    if (found.length) return found;
  }
  return [];
}

function pairsIn(all: Blob[]): [Finder, Finder][] {
  const pills = all.filter((b) => b.elong >= 2.6 && close(b.fill, EYE_SHAPES.pill.fill, 0.6));
  const crosses = all.filter((b) => b.elong <= 1.9 && b.fill >= 0.18 && b.fill <= 0.5);
  const out: { pair: [Finder, Finder]; score: number }[] = [];
  for (const P of pills)
    for (const X of crosses) {
      const scale = Math.hypot(X.x - P.x, X.y - P.y) / SPAN; // pixels per code unit
      if (!(scale > 4)) continue;
      const eP = Math.abs(P.rmax / (EYE_SHAPES.pill.rmax * scale) - 1),
        eX = Math.abs(X.rmax / (EYE_SHAPES.x.rmax * scale) - 1),
        eA = Math.abs(X.n / P.n / (EYE_SHAPES.x.area / EYE_SHAPES.pill.area) - 1);
      if (eP > 0.45 || eX > 0.4 || eA > 0.6) continue;
      out.push({
        pair: [
          { x: P.x, y: P.y, u: scale },
          { x: X.x, y: X.y, u: scale },
        ],
        score: eP + eX + eA,
      });
    }
  return out
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((o) => o.pair);
}
