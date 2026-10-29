// Usage: CHROME=<chrome path> node scripts/byte-art/trace.mjs <mascot.png> <trace.json>, then node scripts/byte-art/build.mjs <trace.json> src/lib/qr/byteCode/byteArt.ts
// Traces the mascot picture into a planar map: regions (flat colours) and the chains of the lines between them. Runs the pixel work in headless Chrome (no image library here).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
const SRC = process.argv[2];
const OUT = process.argv[3];
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage();
const png = readFileSync(SRC).toString('base64');
const art = await p.evaluate(async (png) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + png;
  await img.decode();
  const W = img.width,
    H = img.height;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, W, H).data;
  // colours: 0 clear, 1 plum (the line), 2 mask (dark), 3 green, 4 pale, 5 yellow, 6 pink, 7 shadow
  const PAL = [null, [88, 56, 72], [88, 88, 104], [136, 168, 152], [216, 232, 168], [248, 232, 72], [248, 152, 152]];
  const cls = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const a = d[i * 4 + 3];
    if (a < 30) continue;
    if (a < 200) {
      cls[i] = 7;
      continue;
    }
    let best = 1,
      bd = 1e9;
    for (let k = 1; k < PAL.length; k++) {
      const dd = (d[i * 4] - PAL[k][0]) ** 2 + (d[i * 4 + 1] - PAL[k][1]) ** 2 + (d[i * 4 + 2] - PAL[k][2]) ** 2;
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    }
    cls[i] = best;
  }
  // connected components (4-neighbour) of each colour; the lines (plum) keep only the small separate ones as shapes of their own
  const comp = new Int32Array(W * H).fill(-1);
  const comps = [];
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (comp[s] >= 0) continue;
    const id = comps.length,
      col = cls[s];
    let n = 0;
    comp[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % W,
        y = (i - x) / W;
      if (x > 0 && comp[i - 1] < 0 && cls[i - 1] === col) ((comp[i - 1] = id), stack.push(i - 1));
      if (x < W - 1 && comp[i + 1] < 0 && cls[i + 1] === col) ((comp[i + 1] = id), stack.push(i + 1));
      if (y > 0 && comp[i - W] < 0 && cls[i - W] === col) ((comp[i - W] = id), stack.push(i - W));
      if (y < H - 1 && comp[i + W] < 0 && cls[i + W] === col) ((comp[i + W] = id), stack.push(i + W));
    }
    comps.push({ col, n });
  }
  // the biggest plum component is the line work; a plum component is a "shape" (stitch, tick) when it is small and separate
  let bigPlum = -1;
  comps.forEach((k, i) => {
    if (k.col === 1 && (bigPlum < 0 || k.n > comps[bigPlum].n)) bigPlum = i;
  });
  const MIN = 30;
  const region = new Int32Array(W * H).fill(-1); // component id that owns the pixel (after merging)
  const keep = comps.map((k, i) => (k.col === 1 ? i !== bigPlum && k.n >= 40 && k.n < 2500 : k.n >= MIN));
  // pixels of dropped components (lines, specks) take the nearest kept component: a breadth-first fill from the kept ones
  const queue = [];
  for (let i = 0; i < W * H; i++)
    if (keep[comp[i]]) {
      region[i] = comp[i];
      queue.push(i);
    }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const x = i % W,
      y = (i - x) / W;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (region[j] < 0) {
        region[j] = region[i];
        queue.push(j);
      }
    }
  }
  // lines: which pixels were plum (to tell a drawn line from a plain colour change)
  const plum = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) plum[i] = cls[i] === 1 ? 1 : 0;
  // boundary edges between pixels of different regions; a vertex is (x, y) on the lattice 0..W
  const key = (x, y) => y * (W + 1) + x;
  const adj = new Map(); // vertex -> list of [otherVertex, leftRegion, rightRegion]
  const add = (x0, y0, x1, y1, left, right) => {
    const a = key(x0, y0),
      b = key(x1, y1);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push([b, left, right]);
    adj.get(b).push([a, right, left]); // walking back swaps the sides
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const r = region[y * W + x];
      if (x < W - 1) {
        const r2 = region[y * W + x + 1];
        // vertical edge at x+1 between (x+1,y) and (x+1,y+1); walking down (y increasing) the left-hand side is the pixel at x+1 (screen y down: left of a downward walk is east)
        if (r2 !== r) add(x + 1, y, x + 1, y + 1, r2, r);
      }
      if (y < H - 1) {
        const r2 = region[(y + 1) * W + x];
        // horizontal edge at y+1 between (x,y+1) and (x+1,y+1); walking east the left-hand side is north (screen y down)
        if (r2 !== r) add(x, y + 1, x + 1, y + 1, r, r2);
      }
      // the picture's edge: outside is "none" (-2)
      if (x === 0) add(0, y, 0, y + 1, -2, r);
      if (y === 0) add(x, 0, x + 1, 0, -2, r);
    }
  const vxy = (k) => [k % (W + 1), Math.floor(k / (W + 1))];
  // chains: walk from every vertex that is not an ordinary pass-through (degree 2) until the next one
  const used = new Set();
  const ek = (a, b) => (a < b ? a * 4e6 + b : b * 4e6 + a);
  const chains = [];
  const walk = (start, first) => {
    const pts = [start];
    let prev = start,
      cur = first[0];
    const left = first[1],
      right = first[2];
    used.add(ek(prev, cur));
    pts.push(cur);
    while (adj.get(cur).length === 2) {
      const nx = adj.get(cur).find((e) => e[0] !== prev) ?? adj.get(cur)[0];
      if (used.has(ek(cur, nx[0]))) break;
      used.add(ek(cur, nx[0]));
      prev = cur;
      cur = nx[0];
      pts.push(cur);
    }
    return { pts, left, right };
  };
  for (const [v, es] of adj) if (es.length !== 2) for (const e of es) if (!used.has(ek(v, e[0]))) chains.push(walk(v, e));
  for (const [v, es] of adj) for (const e of es) if (!used.has(ek(v, e[0]))) chains.push(walk(v, e));
  // smooth: Douglas-Peucker, then two rounds of corner cutting that keep the ends (so chains still meet where they should)
  const dp = (pts, eps) => {
    if (pts.length < 3) return pts;
    const [ax, ay] = pts[0],
      [bx, by] = pts[pts.length - 1];
    let md = 0,
      mi = 0;
    const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
      const dd = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (dd > md) {
        md = dd;
        mi = i;
      }
    }
    if (md <= eps) return [pts[0], pts[pts.length - 1]];
    return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
  };
  const chaikin = (pts, closed) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i],
        [x1, y1] = pts[i + 1];
      if (i === 0 && !closed) out.push(pts[0]);
      out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
      if (i === pts.length - 2 && !closed) out.push(pts[pts.length - 1]);
    }
    return out;
  };
  const res = [];
  for (const ch of chains) {
    let pts = ch.pts.map(vxy);
    const closed = ch.pts[0] === ch.pts[ch.pts.length - 1];
    // plum share along the chain: pixels within 3 of the chain that were plum
    let hit = 0,
      tot = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = pts[i];
      let on = 0;
      for (let dy = -3; dy <= 3 && !on; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && plum[yy * W + xx]) {
            on = 1;
            break;
          }
        }
      hit += on;
      tot++;
    }
    const lined = hit / Math.max(1, tot) > 0.7;
    pts = dp(pts, 1.1);
    if (pts.length > 2) pts = chaikin(chaikin(pts, closed), closed);
    res.push({ l: ch.left, r: ch.right, lined, pts: pts.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]) });
  }
  const sx = new Float64Array(comps.length),
    sy = new Float64Array(comps.length);
  for (let i = 0; i < W * H; i++) {
    sx[comp[i]] += i % W;
    sy[comp[i]] += Math.floor(i / W);
  }
  const regs = [];
  comps.forEach((k, i) => {
    if (keep[i]) regs.push({ id: i, col: k.col, n: k.n, cx: sx[i] / k.n, cy: sy[i] / k.n });
  });
  return { W, H, regions: regs, chains: res };
}, png);
writeFileSync(OUT, JSON.stringify(art));
console.log(
  'regions',
  art.regions.length,
  'chains',
  art.chains.length,
  'points',
  art.chains.reduce((a, c) => a + c.pts.length, 0),
  'lined',
  art.chains.filter((c) => c.lined).length,
);
await b.close();
