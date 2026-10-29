import { describe, expect, test } from 'vitest';
import { BLOCKS, NIBBLES, STRETCHES, dashGrid, nibblesOf, payloadFromNibbles } from './layout';
import { FINDERS, DOTS, KEEP_OUT_FINDER, KEEP_OUT_DOT } from './marks';
import { byteInk } from './testInk';
import { decodeBytecode, decodeBytecodeAt } from './decode';
import { decodeTGcode } from '../tgCode/decode';
import { paintInk, paint, type Shot } from '../tgCode/testCamera';

const payloads = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a', 'm9f8e7d6c5b4a', 't13579bdf0246'];
const key = (p: string) => p.slice(0, 9); // what a code carries: the kind and the first 8 hex digits
const flat = (p: { img: Uint8ClampedArray; size: number }): [Uint8ClampedArray, number, number] => [p.img, p.size, p.size];

const shoot = (payload: string, o: Shot) => paintInk(byteInk(payload, o.dark), o);

describe('layout', () => {
  test('there is room for every block, and no cell of one is closer to a mark than the reader allows', () => {
    expect(BLOCKS.length).toBe(NIBBLES);
    for (const block of BLOCKS) {
      expect(block).toHaveLength(10);
      for (const [r, c] of block) {
        const p = STRETCHES[r].cells[c];
        for (const f of Object.values(FINDERS)) expect(Math.hypot(p[0] - f.x, p[1] - f.y)).toBeGreaterThan(KEEP_OUT_FINDER - 1e-9);
        for (const d of Object.values(DOTS)) expect(Math.hypot(p[0] - d.x, p[1] - d.y)).toBeGreaterThan(KEEP_OUT_DOT - 1e-9);
      }
    }
  });
  test('the message round-trips through its cells, and a bar is never shorter than two cells or touching another', () => {
    for (const p of payloads) {
      const nib = nibblesOf(p)!;
      expect(payloadFromNibbles(nib)).toBe(key(p));
      const grid = dashGrid(p)!;
      for (const row of grid) {
        let run = 0;
        for (let c = 0; c <= row.length; c++) {
          if (row[c]) run++;
          else {
            if (run) expect(run).toBeGreaterThanOrEqual(2);
            run = 0;
          }
        }
      }
    }
  });
});

describe('reading', () => {
  test('a clean picture of every sample reads back, at a few sizes and turns', () => {
    for (const p of payloads)
      for (const [px, rot] of [
        [100, 0],
        [70, 0.4],
        [60, -0.8],
        [150, 3.0],
      ] as const) {
        expect(decodeBytecode(...flat(shoot(p, { px, rot })))).toBe(key(p));
      }
  });
  test('the spot is where the code is', () => {
    const got = decodeBytecodeAt(...flat(shoot(payloads[1], { px: 80, rot: 0.3 })));
    expect(got?.payload).toBe(key(payloads[1]));
    expect(got!.spot.x).toBeGreaterThan(0);
  });
  test('a tilted, blurred, noisy picture still reads', () => {
    for (const p of payloads.slice(0, 4)) {
      expect(decodeBytecode(...flat(shoot(p, { px: 110, rot: 0.2, a: 0.1, b: -0.06, blur: 0.8, noise: 10, seed: 3 })))).toBe(key(p));
    }
  });
  test('a TGcode is not read as a Bytecode, nor a Bytecode as a TGcode', () => {
    expect(decodeBytecode(...flat(paint(payloads[0], { px: 90, rot: 0 })))).toBeNull();
    expect(decodeTGcode(...flat(shoot(payloads[0], { px: 90, rot: 0 })))).toBeNull();
  });
});
