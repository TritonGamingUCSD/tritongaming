// Turns the raw trace (trace.mjs) into src/lib/qr/byteCode/byteArt.ts: the regions as paths, the line work as long strokes (chains joined through the junctions where a line simply
// carries on), and the little plum dots, all in code units.
import { readFileSync, writeFileSync } from 'fs';
const art = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
const S = 1.88 / 654, // the drawing and the border round it fit inside the sticker with a margin
  CX = 352,
  CY = 381;
const tx = ([x, y]) => [+((x - CX) * S).toFixed(3), +((y - CY) * S).toFixed(3)];
const colOf = new Map(art.regions.map((r) => [r.id, r.col]));
colOf.set(-2, 0);

// regions as closed paths
const regionPath = (id, keepEyes = false) => {
  const segs = [];
  for (const c of art.chains) {
    // the shapes round his eyes are drawn whole (no holes where the eyes are): the eyes are laid on top, and in the wink they can go without leaving a gap
    if (!keepEyes && (eyeIds.has(c.l) || eyeIds.has(c.r))) continue;
    if (c.l === id) segs.push(c.pts);
    else if (c.r === id) segs.push([...c.pts].reverse());
  }
  const k = (p) => p.join(',');
  const byStart = new Map();
  segs.forEach((s, i) => {
    const a = k(s[0]);
    if (!byStart.has(a)) byStart.set(a, []);
    byStart.get(a).push(i);
  });
  const used = new Set();
  let d = '';
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    let loop = [...segs[i]];
    for (let guard = 0; guard < 400; guard++) {
      if (k(loop[loop.length - 1]) === k(loop[0])) break;
      const nxt = (byStart.get(k(loop[loop.length - 1])) ?? []).find((j) => !used.has(j));
      if (nxt === undefined) break;
      used.add(nxt);
      loop = loop.concat(segs[nxt].slice(1));
    }
    d += 'M' + loop.map((p) => tx(p).join(' ')).join('L') + 'Z';
  }
  return d;
};
// Byte's eyes: the pale pill (left) and the pale X (right), set on the dark mask; they are drawn without an outline, and the reader finds the code by them
const near = (r, px, py) => Math.hypot(r.cx - px, r.cy - py) < 12;
const pillReg = art.regions.find((r) => r.col === 4 && near(r, 255.6, 291.2));
const xReg = art.regions.find((r) => r.col === 4 && near(r, 379.6, 287.6));
const eyeIds = new Set([pillReg.id, xReg.id]);
const shape = (r) => {
  const tr = r.mxx + r.myy,
    d = Math.sqrt(Math.max(0, (r.mxx - r.myy) ** 2 / 4 + r.mxy ** 2));
  return {
    x: tx([r.cx, r.cy])[0],
    y: tx([r.cx, r.cy])[1],
    rmax: +(r.rmax * S).toFixed(4),
    area: +(r.n * S * S).toFixed(5),
    elong: +Math.sqrt((tr / 2 + d) / Math.max(1e-6, tr / 2 - d)).toFixed(2),
    fill: +(r.n / (Math.PI * r.rmax ** 2)).toFixed(3),
  };
};
const eyes = { pill: shape(pillReg), x: shape(xReg) };
// Byte's other two locators: the big yellow scarf (one closed shape) and the biggest of the four facets of the yellow gem above his head
const yellow = art.regions.filter((r) => r.col === 5);
const scarfReg = yellow.reduce((a, b) => (b.n > a.n ? b : a));
const gemReg = yellow.filter((r) => r.n > 600 && tx([r.cx, r.cy])[1] < -0.6).reduce((a, b) => (b.n > a.n ? b : a));
const wings = art.regions.filter((r) => r.col === 4 && r.n > 5000 && Math.abs(tx([r.cx, r.cy])[0]) > 0.5).sort((a, b) => a.cx - b.cx);
const marks = { scarf: shape(scarfReg), gem: shape(gemReg), wingL: shape(wings[0]), wingR: shape(wings[wings.length - 1]) };
// a box round everything that touches a wing: the wings' lines stay solid too (a wing is a locator, so it has to be a closed shape)
const boxOf = (id) => {
  const pts = art.chains.filter((c) => c.l === id || c.r === id).flatMap((c) => c.pts.map(tx));
  return {
    x0: Math.min(...pts.map((p) => p[0])) - 0.03,
    x1: Math.max(...pts.map((p) => p[0])) + 0.03,
    y0: Math.min(...pts.map((p) => p[1])) - 0.03,
    y1: Math.max(...pts.map((p) => p[1])) + 0.03,
  };
};
const wingBoxes = [boxOf(wings[0].id), boxOf(wings[wings.length - 1].id)];
const inWing = (p) => wingBoxes.some((b) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1);
const gemC = tx([gemReg.cx, gemReg.cy]);
const eyeRegions = [pillReg, xReg].map((r) => ({ col: 4, d: regionPath(r.id, true) }));
const regions = art.regions
  .filter((r) => r.col !== 0 && r.col !== 1 && r.col !== 7 && !eyeIds.has(r.id)) // (the traced grey shadow is left out: the components draw a soft one of their own)
  .sort((a, b) => (a.col === 7 ? -1 : b.col === 7 ? 1 : b.n - a.n))
  .map((r) => ({ col: r.col, d: regionPath(r.id) }));
const dots = art.regions.filter((r) => r.col === 1).map((r) => ({ d: regionPath(r.id), c: tx([r.cx, r.cy]), r: +(Math.sqrt(r.n / Math.PI) * S).toFixed(3) }));

// strokes: the drawn lines; those with the mask on neither side may carry data
let pieces = art.chains
  .filter((c) => c.lined && !eyeIds.has(c.l) && !eyeIds.has(c.r))
  .map((c) => ({ pts: c.pts.map(tx), ok: colOf.get(c.l) !== 2 && colOf.get(c.r) !== 2 && (colOf.get(c.l) === 0 || colOf.get(c.r) === 0) }));
const dir = (pts, end) => {
  // the direction leaving the end, over about 0.08 of length
  const a = end === 0 ? pts : [...pts].reverse();
  let acc = 0,
    j = 1;
  for (; j < a.length - 1; j++) {
    acc += Math.hypot(a[j][0] - a[j - 1][0], a[j][1] - a[j - 1][1]);
    if (acc > 0.08) break;
  }
  const dx = a[j][0] - a[0][0],
    dy = a[j][1] - a[0][1],
    L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
};
const key = (p) => p.join(',');
for (let round = 0; round < 200; round++) {
  const at = new Map(); // end point -> [piece index, end]
  pieces.forEach((p, i) => {
    if (!p.ok) return;
    for (const e of [0, 1]) {
      const k = key(e === 0 ? p.pts[0] : p.pts[p.pts.length - 1]);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push([i, e]);
    }
  });
  let best = null;
  for (const [, list] of at) {
    for (let a = 0; a < list.length; a++)
      for (let b = a + 1; b < list.length; b++) {
        if (list[a][0] === list[b][0]) continue;
        const da = dir(pieces[list[a][0]].pts, list[a][1]),
          db = dir(pieces[list[b][0]].pts, list[b][1]);
        const dot = da[0] * db[0] + da[1] * db[1]; // -1: straight on
        if (dot < -0.75 && (!best || dot < best.dot)) best = { dot, a: list[a], b: list[b] };
      }
  }
  if (!best) break;
  const A = pieces[best.a[0]],
    B = pieces[best.b[0]];
  const aPts = best.a[1] === 1 ? A.pts : [...A.pts].reverse(); // ends at the joint
  const bPts = best.b[1] === 0 ? B.pts : [...B.pts].reverse(); // starts at the joint
  const merged = { pts: [...aPts, ...bPts.slice(1)], ok: true };
  pieces = pieces.filter((_, i) => i !== best.a[0] && i !== best.b[0]);
  pieces.push(merged);
}
// the sticker border (second layer): chains from halo.mjs, as smooth closed lines round the whole shape
const halo = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const lenOf0 = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
// lines on the face stay as drawn: a stroke that lies mostly inside the face is not offered to the message
// the gem's own lines stay solid: his gem is a locator, so it has to be a closed shape
const nearGem = (p) => Math.hypot(p[0] - gemC[0], p[1] - gemC[1]) < 0.26;
for (const p of pieces) if (p.ok && p.pts.every(nearGem)) p.ok = false;
for (const p of pieces) if (p.ok && p.pts.every(inWing)) p.ok = false;
const inFace = ([x, y]) => x > -0.58 && x < 0.54 && y > -0.52 && y < -0.1;
for (const p of pieces) if (p.ok && p.pts.filter(inFace).length > p.pts.length * 0.5) p.ok = false;
for (const h of halo) pieces.push({ pts: h.map(tx), ok: true, halo: true });
const lenOf = (pts) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
pieces.sort((a, b) => lenOf(b.pts) - lenOf(a.pts));
console.log(
  'strokes',
  pieces.length,
  'ok',
  pieces.filter((p) => p.ok).length,
  'ok length',
  pieces
    .filter((p) => p.ok)
    .reduce((a, p) => a + lenOf(p.pts), 0)
    .toFixed(2),
  'longest',
  pieces
    .slice(0, 8)
    .map((p) => lenOf(p.pts).toFixed(2))
    .join(' '),
);

// The locators are found in a picture by their light inside (the dark lines round them are not part of it), so what the reader expects is the middle and the size of that inside: the region
// without the band of its lines (half a line's width and a little more on each side), not the region up to the middle of the lines.
{
  const CELL = 0.05,
    band = 0.014;
  const hash = new Map();
  const segs = [];
  for (const p of pieces) for (let i = 1; i < p.pts.length; i++) segs.push([p.pts[i - 1], p.pts[i]]);
  for (const g of segs) {
    const x0 = Math.floor((Math.min(g[0][0], g[1][0]) - band) / CELL),
      x1 = Math.floor((Math.max(g[0][0], g[1][0]) + band) / CELL);
    const y0 = Math.floor((Math.min(g[0][1], g[1][1]) - band) / CELL),
      y1 = Math.floor((Math.max(g[0][1], g[1][1]) + band) / CELL);
    for (let a = x0; a <= x1; a++)
      for (let b = y0; b <= y1; b++) {
        const k = a + ',' + b;
        if (!hash.has(k)) hash.set(k, []);
        hash.get(k).push(g);
      }
  }
  const nearLine = (x, y) => {
    for (const [p, q] of hash.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)) ?? []) {
      const vx = q[0] - p[0],
        vy = q[1] - p[1];
      const t = Math.max(0, Math.min(1, ((x - p[0]) * vx + (y - p[1]) * vy) / (vx * vx + vy * vy || 1)));
      if (Math.hypot(x - p[0] - t * vx, y - p[1] - t * vy) < band) return true;
    }
    return false;
  };
  const inside = (reg) => {
    const loops = regionPath(reg.id)
      .split('M')
      .filter(Boolean)
      .map((l) =>
        l
          .replace('Z', '')
          .split('L')
          .map((q) => q.trim().split(' ').map(Number)),
      );
    const all = loops.flat();
    const bx0 = Math.min(...all.map((q) => q[0])),
      bx1 = Math.max(...all.map((q) => q[0])),
      by0 = Math.min(...all.map((q) => q[1])),
      by1 = Math.max(...all.map((q) => q[1]));
    const inLoops = (x, y) => {
      let on = false;
      for (const loop of loops)
        for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
          const [xi, yi] = loop[i],
            [xj, yj] = loop[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
        }
      return on;
    };
    const step = 0.005,
      pts = [];
    for (let y = by0; y <= by1; y += step) for (let x = bx0; x <= bx1; x += step) if (inLoops(x, y) && !nearLine(x, y)) pts.push([x, y]);
    const n = pts.length,
      cx = pts.reduce((a, q) => a + q[0], 0) / n,
      cy = pts.reduce((a, q) => a + q[1], 0) / n;
    return { x: +cx.toFixed(4), y: +cy.toFixed(4), area: +(n * step * step).toFixed(5), rmax: +Math.max(...pts.map((q) => Math.hypot(q[0] - cx, q[1] - cy))).toFixed(4) };
  };
  const ids = { scarf: scarfReg, gem: gemReg, wingL: wings[0], wingR: wings[wings.length - 1] };
  for (const [k, reg] of Object.entries(ids)) marks[k] = { ...marks[k], ...inside(reg) };
}

const ts = `// Generated by scripts/byte-art/trace.mjs and build.mjs from the Triton Gaming mascot, Byte: the drawing traced into flat-colour regions, the lines between them (strokes), and the
// little plum dots, in code units (see marks.ts). Do not edit by hand; run the scripts again with a new picture.
// Colours: 2 mask, 3 green, 4 pale, 5 yellow, 6 pink, 7 shadow. A stroke is \`ok\` when it may carry the message (an outer outline or the sticker border, \`halo\`, round the whole shape).
/* prettier-ignore */
export const REGIONS: { col: number; d: string }[] = [
${regions.map((r) => `  { col: ${r.col}, d: '${r.d}' },`).join('\n')}
];
/* prettier-ignore */
export const EYES: { col: number; d: string }[] = [
${eyeRegions.map((r) => `  { col: ${r.col}, d: '${r.d}' },`).join('\n')}
];
/** What the reader looks for: the two eyes' middles and their shapes (the pill is long and thin, the X is a cross: low fill, round). */
export const EYE_SHAPES = ${JSON.stringify(eyes)};
/** His other locators: the yellow scarf, a facet of the gem and the two wings (middles and sizes). */
export const MARK_SHAPES = ${JSON.stringify(marks)};
/* prettier-ignore */
export const DOTS_OF_INK: { d: string; x: number; y: number; r: number }[] = [
${dots.map((r) => `  { d: '${r.d}', x: ${r.c[0]}, y: ${r.c[1]}, r: ${r.r} },`).join('\n')}
];
/* prettier-ignore */
export const STROKES: { ok: boolean; halo?: boolean; pts: [number, number][] }[] = [
${pieces.map((p) => `  { ok: ${p.ok},${p.halo ? ' halo: true,' : ''} pts: ${JSON.stringify(p.pts)} },`).join('\n')}
];
`;
writeFileSync(OUT, ts);
console.log('bytes', ts.length);
