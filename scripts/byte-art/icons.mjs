// Draws Byte as the portal's icons from his own artwork (src/lib/qr/byteCode/byteArt.ts): the app icons (a full Byte sticker on the portal's cream), the favicon (his head and gem, tighter, so it
// reads at 16px), the maskable icon (smaller, inside the safe zone) and the notification badge (a one-colour silhouette: Android uses only the shape). Usage:
//   PLAYWRIGHT=/path/to/playwright/index.js CHROME=/path/to/chrome node scripts/byte-art/icons.mjs        (CHROME only when Playwright has no browser of its own)
import fs from 'fs';
import { pathToFileURL } from 'url';
// Playwright is not a dependency of the site: point PLAYWRIGHT at its index.js (or have it installed where `import 'playwright'` finds it).
const pw = await import(process.env.PLAYWRIGHT ? pathToFileURL(process.env.PLAYWRIGHT).href : 'playwright');

const art = fs.readFileSync('src/lib/qr/byteCode/byteArt.ts', 'utf8');
const all = [...art.matchAll(/\{ col: (\d+), d: '([^']*)' \},/g)].map((m) => ({ col: +m[1], d: m[2] }));
const nReg = (art.split('export const EYES')[0].match(/\{ col: \d+, d: '/g) || []).length;
const regions = all.slice(0, nReg),
  eyes = all.slice(nReg);
const strokes = eval(art.match(/export const STROKES[^=]*=\s*(\[[\s\S]*?\]);\s*\n/)[1]);
const COL = { 2: '#585866', 3: '#8ba699', 4: '#d9e6b0', 5: '#f4e65e', 6: '#ee9c9c', 7: '#b8b4bb' };
const PLUM = '#483848',
  CREAM = '#f3f1ea';
const line = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L');
// his silhouette: the two chains of the sticker border, each closed straight across (their union is the whole shape)
const halos = strokes.filter((s) => s.halo);
const silhouette = halos.map((s) => line(s.pts) + 'Z').join('');
const body = (silhouetteFill) => `
<path d="${silhouette}" fill="${silhouetteFill}" stroke="${silhouetteFill}" stroke-width="0.05" stroke-linejoin="round"/>
${regions.map((r) => `<path d="${r.d}" fill="${COL[r.col]}" ${r.col === 7 ? 'fill-opacity=".55"' : ''}/>`).join('')}
${strokes
  .filter((s) => !s.ok)
  .map((s) => `<path d="${line(s.pts)}" fill="none" stroke="${PLUM}" stroke-width="0.03" stroke-linecap="round" stroke-linejoin="round"/>`)
  .join('')}
${strokes
  .filter((s) => s.ok && !s.halo)
  .map((s) => `<path d="${line(s.pts)}" fill="none" stroke="${PLUM}" stroke-width="0.05" stroke-linecap="round" stroke-linejoin="round"/>`)
  .join('')}
${halos.map((s) => `<path d="${line(s.pts)}" fill="none" stroke="${PLUM}" stroke-width="0.05" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${eyes.map((r) => `<path d="${r.d}" fill="${COL[4]}"/>`).join('')}`;
const page = (w, h, bg, box, content) =>
  `<html><body style="margin:0;background:${bg === 'none' ? 'transparent' : bg}"><svg width="${w}" height="${h}" viewBox="${box}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg">${content}</svg></body></html>`;

const jobs = [
  // [file, size, background, viewBox, content]
  ['public/icons/icon-512.png', 512, CREAM, '-1.12 -1.12 2.24 2.24', body('#ffffff')],
  ['public/icons/icon-192.png', 192, CREAM, '-1.12 -1.12 2.24 2.24', body('#ffffff')],
  ['public/icons/apple-touch-icon.png', 180, CREAM, '-1.12 -1.12 2.24 2.24', body('#ffffff')],
  ['public/icons/maskable-512.png', 512, CREAM, '-1.5 -1.5 3 3', body('#ffffff')],
  ['src/app/icon.png', 256, 'none', '-0.64 -1.02 1.28 1.28', body('#ffffff')],
  [
    'public/icons/badge-96.png',
    96,
    'none',
    '-1.0 -1.0 2 2',
    `<defs><mask id="m"><rect x="-1" y="-1" width="2" height="2" fill="#fff"/>${eyes.map((r) => `<path d="${r.d}" fill="#000"/>`).join('')}</mask></defs>
<g mask="url(#m)"><path d="${silhouette}" fill="#fff" stroke="#fff" stroke-width="0.09" stroke-linejoin="round"/></g>`,
  ],
];
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const [file, size, bg, box, content] of jobs) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, size, bg, box, content));
  await p.screenshot({ path: file, omitBackground: bg === 'none' });
  await p.close();
  console.log('wrote', file);
}
await browser.close();
