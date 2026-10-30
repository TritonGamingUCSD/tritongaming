import { test } from 'vitest';
import { writeFileSync } from 'fs';
import { decodeBytecode } from './decode';
import { byteInk } from './testInk';
import { paintInk, type Shot } from '../tgCode/testCamera';

// The Bytecode under bad conditions, light and dark, by size, for tuning and for reporting. It is slow, so it only runs when asked: BYTE_BENCH=1 npx vitest run src/lib/qr/byteCode/bench.test.ts
// (BYTE_ONLY=tilt,blur picks conditions, BYTE_SIZES=100,130 the sizes, BYTE_N the pictures per cell; writes the table to the file named by BYTE_BENCH_OUT, default byte-bench.txt in the working directory).
const run = process.env.BYTE_BENCH ? test : test.skip;
const P = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a', 'm9f8e7d6c5b4a', 't13579bdf0246'];
const conditions: [string, Partial<Shot>][] = [
  ['clean', {}],
  ['blur 0.8px', { blur: 0.8 }],
  ['blur 1.3px', { blur: 1.3 }],
  ['noise 15', { noise: 15 }],
  ['low contrast 0.5', { contrast: 0.5 }],
  ['dark exposure -60', { brightness: -60, contrast: 0.7 }],
  ['gamma 1.8', { gamma: 1.8 }],
  ['motion 4px', { motion: 4, motionAngle: 0.7 }],
  ['tilt 0.05', { a: 0.05, b: -0.03 }],
  ['tilt 0.1', { a: 0.1, b: -0.06 }],
  ['tilt 0.15', { a: -0.15, b: 0.1 }],
  ['glare', { glare: true }],
  ['vignette 0.5', { vignette: 0.5 }],
  ['thumb over an edge', { thumb: { x: 0.5, y: 0.45, r: 0.2 } }],
  ['blur + noise + low contrast', { blur: 0.8, noise: 12, contrast: 0.65 }],
];
const sizes = (process.env.BYTE_SIZES ?? '80,100,130,180,260').split(',').map(Number);
const N = Number(process.env.BYTE_N ?? 8);
const only = process.env.BYTE_ONLY?.split(',') ?? null; // run just the conditions whose name contains one of these

run(
  'bytecode under bad conditions',
  () => {
    const lines: string[] = [];
    let wrongReads = 0;
    for (const dark of [false, true]) {
      lines.push(
        `\n== ${dark ? 'dark' : 'light'} (share of ${N} pictures read, by code radius in pixels; diameter is double) ==`,
        'condition'.padEnd(30) + sizes.map((s) => `r${s}`.padStart(8)).join(''),
      );
      for (const [name, c] of conditions) {
        if (only && !only.some((o) => name.includes(o))) continue;
        let row = name.padEnd(30);
        for (const px of sizes) {
          let ok = 0;
          for (let i = 0; i < N; i++) {
            const p = P[i % P.length];
            const img = paintInk(byteInk(p, dark), { px, rot: (i * 0.9) % 6.28, seed: i + 1, dark, ...c } as Shot);
            const got = decodeBytecode(img.img, img.size, img.size);
            if (got === p.slice(0, 9)) ok++;
            else if (got) {
              wrongReads++;
              lines.push(`WRONG: ${dark ? 'dark' : 'light'} ${name} r${px} picture ${i}: read ${got}, drawn ${p.slice(0, 9)}`);
            }
          }
          row += `${ok}/${N}`.padStart(8);
        }
        lines.push(row);
      }
    }
    lines.push(`\nwrong reads: ${wrongReads}`);
    writeFileSync(process.env.BYTE_BENCH_OUT ?? 'byte-bench.txt', lines.join('\n'));
  },
  3_600_000,
);
