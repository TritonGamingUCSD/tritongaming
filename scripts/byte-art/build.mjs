// Turns the raw trace (trace.mjs) into src/lib/qr/byteCode/byteArt.ts: the regions as paths, the line work as long strokes (chains joined through the junctions where a line simply
// carries on), and the little plum dots, all in code units.
import { readFileSync, writeFileSync } from 'fs';
const art = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const OUT = process.argv[3];
const S = 1.9 / 622,
  CX = 352,
  CY = 381;
const tx = ([x, y]) => [+((x - CX) * S).toFixed(3), +((y - CY) * S).toFixed(3)];
const colOf = new Map(art.regions.map((r) => [r.id, r.col]));
colOf.set(-2, 0);

// regions as closed paths
const regionPath = (id) => {
  const segs = [];
  for (const c of art.chains) {
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
const eyeRegions = [pillReg, xReg].map((r) => ({ col: 4, d: regionPath(r.id) }));
const regions = art.regions
  .filter((r) => r.col !== 0 && r.col !== 1 && !eyeIds.has(r.id))
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
