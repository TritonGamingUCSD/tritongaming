// The sticker border: the outline of the mascot's solid shape grown outwards by a fixed distance, as chains of points in picture pixels (the second layer of line work).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
const SRC = process.argv[2];
const OUT = process.argv[3];
const R = Number(process.argv[4] || 16);
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage();
const png = readFileSync(SRC).toString('base64');
const res = await p.evaluate(
  async ([png, R]) => {
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
    // the solid shape (the shadow is not part of it)
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = d[i * 4 + 3] >= 200 ? 1 : 0;
    // distance to the shape (a two-pass chamfer, close enough to a true distance)
    const INF = 1e9;
    const dist = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) dist[i] = solid[i] ? 0 : INF;
    const a = 1,
      dd = 1.4142;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = dist[i];
        if (x > 0) v = Math.min(v, dist[i - 1] + a);
        if (y > 0) {
          v = Math.min(v, dist[i - W] + a);
          if (x > 0) v = Math.min(v, dist[i - W - 1] + dd);
          if (x < W - 1) v = Math.min(v, dist[i - W + 1] + dd);
        }
        dist[i] = v;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let v = dist[i];
        if (x < W - 1) v = Math.min(v, dist[i + 1] + a);
        if (y < H - 1) {
          v = Math.min(v, dist[i + W] + a);
          if (x < W - 1) v = Math.min(v, dist[i + W + 1] + dd);
          if (x > 0) v = Math.min(v, dist[i + W - 1] + dd);
        }
        dist[i] = v;
      }
    // fill holes of the grown shape that are small (the gap between a wing and the body), so the border does not wander into slits
    let grown = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) grown[i] = dist[i] <= R ? 1 : 0;
    // crack edges of the grown shape: vertex (x, y); the shape is on the left of each edge
    const key = (x, y) => y * (W + 1) + x;
    const adj = new Map();
    const add = (x0, y0, x1, y1) => {
      const k0 = key(x0, y0),
        k1 = key(x1, y1);
      if (!adj.has(k0)) adj.set(k0, []);
      if (!adj.has(k1)) adj.set(k1, []);
      adj.get(k0).push(k1);
      adj.get(k1).push(k0);
    };
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : grown[y * W + x]);
    for (let y = 0; y <= H; y++)
      for (let x = 0; x <= W; x++) {
        if (at(x, y) !== at(x - 1, y)) add(x, y, x, y + 1);
        if (at(x, y) !== at(x, y - 1)) add(x, y, x + 1, y);
      }
    const used = new Set();
    const ek = (p, q) => (p < q ? p * 4e6 + q : q * 4e6 + p);
    const chains = [];
    const walk = (start, first) => {
      const pts = [start, first];
      used.add(ek(start, first));
      let prev = start,
        cur = first;
      while (adj.get(cur).length === 2) {
        const nx = adj.get(cur).find((v) => v !== prev) ?? adj.get(cur)[0];
        if (used.has(ek(cur, nx))) break;
        used.add(ek(cur, nx));
        prev = cur;
        cur = nx;
        pts.push(cur);
      }
      return pts;
    };
    for (const [v, es] of adj) if (es.length !== 2) for (const e of es) if (!used.has(ek(v, e))) chains.push(walk(v, e));
    for (const [v, es] of adj) for (const e of es) if (!used.has(ek(v, e))) chains.push(walk(v, e));
    const xy = (k) => [k % (W + 1), Math.floor(k / (W + 1))];
    const dp = (pts, eps) => {
      if (pts.length < 3) return pts;
      const [ax, ay] = pts[0],
        [bx, by] = pts[pts.length - 1];
      let md = 0,
        mi = 0;
      const L = Math.hypot(bx - ax, by - ay) || 1;
      for (let i = 1; i < pts.length - 1; i++) {
        const q = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
        if (q > md) {
          md = q;
          mi = i;
        }
      }
      if (md <= eps) return [pts[0], pts[pts.length - 1]];
      return [...dp(pts.slice(0, mi + 1), eps).slice(0, -1), ...dp(pts.slice(mi), eps)];
    };
    const chaikin = (pts) => {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i],
          [x1, y1] = pts[i + 1];
        out.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25], [x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    const out = [];
    for (const ch of chains) {
      let pts = ch.map(xy);
      if (pts.length < 40) continue; // specks
      const closed = ch[0] === ch[ch.length - 1];
      if (closed) {
        const mid = Math.floor(pts.length / 2);
        pts = [...dp(pts.slice(0, mid + 1), 1.4), ...dp(pts.slice(mid), 1.4).slice(1)];
      } else pts = dp(pts, 1.4);
      // a few rounds of corner cutting make the border as smooth as a drawn line
      for (let k = 0; k < 4; k++) pts = chaikin(pts);
      out.push(pts.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]));
    }
    return out;
  },
  [png, R],
);
writeFileSync(OUT, JSON.stringify(res));
console.log(
  'border chains',
  res.length,
  'points',
  res.reduce((a, c) => a + c.length, 0),
);
await b.close();
