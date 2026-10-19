import { test } from 'vitest';
import { writeFileSync } from 'fs';
import { paint, type Shot, type Format } from './testCamera';
import { decodeTGcodeAt } from './decode';

// A comparison of the two formats under bad conditions, for tuning. It is slow, so it only runs when asked: TG_BENCH=1 npx vitest run src/lib/qr/tgCode/bench.test.ts
const run = process.env.TG_BENCH ? test : test.skip;
const P = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a', 'm9f8e7d6c5b4a', 't13579bdf0246'];
const conditions: [string, Partial<Shot>][] = [
  ['clean', {}], ['clean, one ink (no colours)', { mono: true }],
  ['blur 0.8px', { blur: 0.8 }], ['blur 1.3px', { blur: 1.3 }], ['blur 1.8px', { blur: 1.8 }],
  ['noise 15', { noise: 15 }], ['noise 30', { noise: 30 }],
  ['low contrast 0.45', { contrast: 0.45 }], ['dark exposure -60', { brightness: -60, contrast: 0.7 }], ['gamma 1.8', { gamma: 1.8 }],
  ['motion 4px', { motion: 4, motionAngle: 0.7 }], ['motion 8px', { motion: 8, motionAngle: 2.2 }],
  ['tilt 0.08', { a: 0.08, b: -0.05 }], ['tilt 0.12', { a: -0.1, b: 0.07 }], ['tilt 0.18', { a: 0.18, b: -0.1 }], ['tilt 0.25', { a: -0.2, b: 0.15 }], ['tilt 0.3', { a: -0.3, b: 0.2 }],
  ['glare', { glare: true }], ['vignette 0.5', { vignette: 0.5 }],
  ['thumb over an edge', { thumb: { x: 0.5, y: 0.45, r: 0.2 } }], ['thumb big', { thumb: { x: -0.4, y: 0.5, r: 0.32 } }],
  ['blur + noise + low contrast', { blur: 1.0, noise: 18, contrast: 0.6 }],
  ['blur 1.3 one ink', { blur: 1.3, mono: true }], ['low contrast 0.45 one ink', { contrast: 0.45, mono: true }],
];
const sizes = (process.env.TG_SIZES ?? '30,36,44,56,75,110').split(',').map(Number);
const N = Number(process.env.TG_N ?? 10);
const ONLY = process.env.TG_ONLY;
let wrongReads = 0;

run('compare formats', () => {
  const lines: string[] = [];
  const header = 'condition'.padEnd(30) + sizes.map((s) => `r${s}`.padStart(8)).join('');
  for (const fmt of (process.env.TG_FORMATS ?? 'v2,legacy').split(',') as Format[]) {
    lines.push(`\n== ${fmt} (share of ${N * 2} pictures read, by code radius in pixels; diameter is double) ==`, header);
    for (const [name, c] of conditions) {
      if (ONLY && !ONLY.split(',').some((o) => name.includes(o))) continue;
      const row: string[] = [];
      for (const px of sizes) {
        let ok = 0, t = 0;
        for (let i = 0; i < N; i++) for (const dark of [false, true]) {
          t++;
          const p = P[(i + (dark ? 3 : 0)) % P.length];
          const pic = paint(p, { px, rot: (i * 1.37 + (dark ? 0.6 : 0)) % 6.28, dark, seed: 100 + i * 7 + px, ss: 2, ...c }, fmt);
          const got = decodeTGcodeAt(pic.img, pic.size, pic.size);
          if (got && got.payload === (fmt === 'v2' ? p.slice(0, 9) : p)) ok++;
          else if (got) wrongReads++;
        }
        row.push(`${Math.round((100 * ok) / t)}%`.padStart(8));
      }
      lines.push(name.padEnd(30) + row.join(''));
    }
  }
  lines.push(`\nwrong reads (a different code than the one drawn): ${wrongReads}`);
  const text = lines.join('\n');
  writeFileSync(process.env.TG_OUT ?? '/tmp/zz/bench.txt', text);
  console.log(text);
}, 3_000_000);
