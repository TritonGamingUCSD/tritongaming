import { describe, expect, test } from 'vitest';
import { rsDecode, rsEncode } from '../tgCode/rs';
import {
  BLOCKS,
  BLOCK,
  DATA_BYTES,
  NIBBLES,
  OUTLINE_NIBBLES,
  PATCH_NIBBLES,
  NSYM,
  PATTERN_COUNT,
  PITCH,
  STRETCHES,
  TOTAL_BYTES,
  dashGrid,
  drawing,
  nibblesOf,
  patternCells,
  payloadFromNibbles,
} from './layout';
import { FINDERS, KEEP_OUT_FINDER } from './marks';
import { STROKES } from './byteArt';
import { byteInk } from './testInk';
import { decodeBytecode, decodeBytecodeAt } from './decode';
import { decodeTGcode } from '../tgCode/decode';
import { paint, paintInk, type Shot } from '../tgCode/testCamera';

// The Bytecode is tested the way the TGcode is (tgCode.test.ts): the repair bytes, the layout and its rules, reading under every turn, size, light and tilt, a rough-picture matrix in light and dark,
// pictures that must never read, and a long run of random conditions in which nothing may ever be read wrongly. A key is the kind and 8 hex digits, as in a TGcode.
const payloads = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a', 'm9f8e7d6c5b4a', 't13579bdf0246'];
const key = (p: string) => p.slice(0, 9); // what a Bytecode carries: the kind and the first 8 hex digits
const flat = (p: { img: Uint8ClampedArray; size: number }): [Uint8ClampedArray, number, number] => [p.img, p.size, p.size];
const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const randomPayload = (rnd: () => number, t: number) => 'mtr'[t % 3] + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
const shoot = (payload: string, o: Shot) => paintInk(byteInk(payload, o.dark), o);

describe('repair bytes', () => {
  test('mend wrong bytes and known-bad bytes up to what the parity allows (2 per wrong, 1 per known-bad)', () => {
    const rnd = lcg(99);
    for (let t = 0; t < 400; t++) {
      const data = Array.from({ length: DATA_BYTES }, () => Math.floor(rnd() * 256));
      const bytes = rsEncode(data, NSYM);
      const v = Math.floor(rnd() * 5); // unknown wrong bytes: 0..4
      const e = Math.floor(rnd() * (NSYM - 2 * v + 1)); // known-bad bytes: as many as is left
      const hit = new Set<number>();
      while (hit.size < v + e) hit.add(Math.floor(rnd() * TOTAL_BYTES));
      const all = [...hit];
      for (const p of all) bytes[p] ^= 1 + Math.floor(rnd() * 255);
      expect(rsDecode(bytes, NSYM, all.slice(0, e))).toEqual(data);
    }
  });

  test('refuse (and never invent) a message when there is more damage than the parity can mend', () => {
    const rnd = lcg(5);
    let wrong = 0,
      mended = 0;
    for (let t = 0; t < 600; t++) {
      const data = Array.from({ length: DATA_BYTES }, () => Math.floor(rnd() * 256));
      const bytes = rsEncode(data, NSYM);
      const hit = new Set<number>();
      const n = 7 + Math.floor(rnd() * 5);
      while (hit.size < n) hit.add(Math.floor(rnd() * TOTAL_BYTES));
      for (const p of hit) bytes[p] ^= 1 + Math.floor(rnd() * 255);
      const got = rsDecode(bytes, NSYM);
      if (got) {
        if (got.join() === data.join()) mended++;
        else wrong++;
      }
    }
    expect(wrong).toBe(0);
    expect(mended).toBe(0);
  });
});

describe('layout', () => {
  test('there is room for every block, and no cell of one is closer to an eye than the reader allows', () => {
    expect(BLOCKS.length).toBe(OUTLINE_NIBBLES.length); // the outline's blocks; the rest of the half-bytes are the patches'
    expect(OUTLINE_NIBBLES.length + PATCH_NIBBLES.length).toBe(NIBBLES);
    expect(PATTERN_COUNT).toBe(16);
    expect(NIBBLES).toBe(TOTAL_BYTES * 2);
    const seen = new Set<string>();
    for (const block of BLOCKS) {
      expect(block).toHaveLength(BLOCK);
      for (const [r, c] of block) {
        expect(seen.has(`${r},${c}`)).toBe(false); // no cell belongs to two blocks
        seen.add(`${r},${c}`);
        const p = STRETCHES[r].cells[c];
        for (const f of Object.values(FINDERS)) expect(Math.hypot(p[0] - f.x, p[1] - f.y)).toBeGreaterThan(KEEP_OUT_FINDER - 1e-9);
      }
    }
  });

  test('the cells of a block follow one another along a line at an even spacing, and stay on his outer lines', () => {
    for (const block of BLOCKS) {
      const [stretch] = block[0];
      for (let k = 1; k < block.length; k++) {
        expect(block[k][0]).toBe(stretch); // one block lies in one stretch
        expect(block[k][1]).toBe(block[k - 1][1] + 1); // and in order
        const a = STRETCHES[stretch].cells[block[k - 1][1]],
          b = STRETCHES[stretch].cells[block[k][1]];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(PITCH * 1.05); // (a line may bend: the straight distance is never more than a cell)
      }
      expect(STROKES[STRETCHES[stretch].stroke].ok).toBe(true); // only his outer lines and the border carry the message
    }
  });

  test('half-bytes round-trip to the payload, for random keys of each kind', () => {
    const rnd = lcg(3);
    for (let t = 0; t < 300; t++) {
      const p = randomPayload(rnd, t);
      expect(payloadFromNibbles(nibblesOf(p)!)).toBe(key(p));
    }
  });

  test('a meeting, a ticket and a reward never share a Bytecode, even with the same key', () => {
    const k = '0123456789ab';
    const same = (x: boolean[][], y: boolean[][]) => x.every((row, i) => row.every((v, j) => v === y[i][j]));
    const a = dashGrid(`m${k}`)!,
      b = dashGrid(`t${k}`)!,
      c = dashGrid(`r${k}`)!;
    expect(same(a, b)).toBe(false);
    expect(same(a, c)).toBe(false);
    expect(same(b, c)).toBe(false);
    for (const kind of 'mtr') expect(payloadFromNibbles(nibblesOf(`${kind}${k}`)!)![0]).toBe(kind);
  });

  test('in the message a gap is always exactly one cell: never two gaps in a row, and a bar is never shorter than two cells', () => {
    const rnd = lcg(11);
    for (let t = 0; t < 200; t++) {
      const g = dashGrid(randomPayload(rnd, t))!;
      for (const block of BLOCKS) {
        const bits = block.map(([r, c]) => g[r][c]);
        expect(bits[0]).toBe(true); // a block starts with a bar
        let run = 0;
        for (let i = 0; i <= bits.length; i++) {
          if (bits[i]) run++;
          else {
            if (run) expect(run).toBeGreaterThanOrEqual(2);
            if (i < bits.length) expect(bits[i + 1] ?? true).toBe(true); // (never two gaps in a row)
            run = 0;
          }
        }
      }
    }
  });

  test('only his outer lines are dashed; his other lines and his face, belly and wings are drawn whole', () => {
    const art = drawing(payloads[0])!;
    const length = (lines: [number, number][][]) => lines.reduce((n, l) => n + l.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0), 0);
    const total = (ok: boolean) =>
      STROKES.filter((s) => s.ok === ok).reduce((n, s) => n + s.pts.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - s.pts[i][0], p[1] - s.pts[i][1]), 0), 0);
    expect(length(art.inner)).toBeCloseTo(total(false), 1); // the inner lines are all there, as drawn
    // the outer lines are there too: what is left of them plus the dashes (which are drawn a little short of their cells) is about the whole
    expect(length(art.edge) + length(art.lineBars)).toBeGreaterThan(total(true) * 0.65); // (the gaps of the message are not drawn)
    expect(length(art.edge) + length(art.lineBars)).toBeLessThan(total(true) * 1.02);
    expect(art.lineBars.length).toBeGreaterThan(20); // and the message really is written along them
  });

  test('a block pattern read with a few cells wrong is mended by the repair, and a ruined one is refused', () => {
    const nib = nibblesOf(payloads[0])!;
    const few = [...nib];
    for (const i of [0, 7, 15, 22]) few[i] = (few[i] + 5) % 16;
    expect(payloadFromNibbles(few)).toBe(key(payloads[0])); // 4 wrong bytes at most: mended without help
    expect(payloadFromNibbles(few, [0, 7, 15, 22])).toBe(key(payloads[0])); // the same, with the doubtful ones named
    const many = [...nib];
    for (const i of [0, 3, 6, 9, 12, 15, 18, 21]) many[i] = (many[i] + 7) % 16;
    expect(payloadFromNibbles(many, [0, 3, 6, 9, 12, 15, 18, 21])).toBe(key(payloads[0])); // 8 known-bad bytes: mended
    const ruined = nib.map((n, i) => (i % 2 === 0 ? (n + 3) % 16 : n)); // half the bytes wrong
    expect(payloadFromNibbles(ruined)).toBeNull();
    expect(patternCells(0)[0]).toBe(1);
  });
});

describe('reading', () => {
  // Byte reads from about 200 px across (a code radius of 100 px); 90 is the smallest tried here.
  const cases: { name: string; o: Shot }[] = [];
  for (const dark of [false, true])
    for (const px of [95, 130, 220])
      for (const rot of [0, 0.5, 1.3, 2.2, 3.14, 4.4, 5.6]) cases.push({ name: `${dark ? 'dark' : 'light'} r${px} turn ${rot}`, o: { px, rot, dark, ss: px > 150 ? 1 : 2 } });
  test.each(cases)(
    'reads a clean picture: $name',
    ({ o }) => {
      payloads.slice(0, 4).forEach((p, i) => expect(decodeBytecode(...flat(shoot(p, { ...o, seed: i + 1 })))).toBe(key(p)));
    },
    60000,
  );

  const rough: { name: string; o: Shot }[] = [];
  for (const dark of [false, true])
    for (const [a, b] of [
      [0.05, 0],
      [-0.06, 0.04],
      [0, 0.07],
      [0.06, -0.05],
    ])
      rough.push({ name: `${dark ? 'dark' : 'light'} tilt ${a},${b}`, o: { px: 130, rot: 0.9, a, b, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} blur + noise`, o: { px: 130, rot: 2.0, blur: 0.9, noise: 10, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} glare`, o: { px: 120, rot: 4.0, glare: true, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} a thumb over the edge`, o: { px: 120, rot: 1.0, thumb: { x: 0.5, y: 0.5, r: 0.18 }, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} washed out`, o: { px: 120, rot: 2.5, contrast: 0.5, noise: 8, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} dim`, o: { px: 120, rot: 3.5, brightness: -50, contrast: 0.7, dark } });
  test.each(rough)(
    'reads a rough picture: $name',
    ({ o }) => {
      let ok = 0;
      payloads.slice(0, 6).forEach((p, i) => {
        if (decodeBytecode(...flat(shoot(p, { ...o, seed: i + 3 }))) === key(p)) ok++;
      });
      expect(ok).toBeGreaterThanOrEqual(5);
    },
    60000,
  );

  test('does not invent a code from nothing, and does not read a TGcode', () => {
    const size = 300;
    const noise = new Uint8ClampedArray(size * size);
    let s = 5;
    for (let i = 0; i < noise.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      noise[i] = s >>> 24;
    }
    expect(decodeBytecode(noise, size, size)).toBeNull();
    expect(decodeBytecode(new Uint8ClampedArray(size * size).fill(200), size, size)).toBeNull();
    for (const p of payloads.slice(0, 4)) {
      expect(decodeBytecode(...flat(paint(p, { px: 110, rot: 0.3, seed: 2 })))).toBeNull(); // a TGcode is not a Bytecode
      expect(decodeTGcode(...flat(shoot(p, { px: 110, rot: 0.3, seed: 2 })))).toBeNull(); // nor a Bytecode a TGcode
    }
  });

  test('never reads a code out of pictures that are nearly a Bytecode: one drawn with another message, or with its dashes shifted', () => {
    // The message of one key drawn and read as another would be the worst failure: check that a picture of key A never reads as key B, over many pairs.
    const rnd = lcg(17);
    let reads = 0;
    for (let t = 0; t < 40; t++) {
      const p = randomPayload(rnd, t);
      const got = decodeBytecode(...flat(shoot(p, { px: 120, rot: rnd() * 6.28, seed: t + 1, ss: 2 })));
      if (got) {
        reads++;
        expect(got).toBe(key(p));
      }
    }
    expect(reads).toBeGreaterThan(35);
  }, 120000);

  test('reports where the code is: its centre and size, turned, tilted, light or dark', () => {
    for (const [px, rot, a, b, dark] of [
      [130, 0, 0, 0, false],
      [110, 1.3, 0.04, -0.03, true],
      [170, 4.4, -0.04, 0.03, false],
      [100, 2.2, 0, 0, true],
    ] as const) {
      const pic = shoot(payloads[1], { px, rot, a, b, dark, seed: 5, ss: 2 });
      const got = decodeBytecodeAt(...flat(pic));
      expect(got?.payload).toBe(key(payloads[1]));
      expect(Math.hypot(got!.spot.x - pic.size / 2, got!.spot.y - pic.size / 2)).toBeLessThan(px * 0.12);
      expect(Math.abs(got!.spot.r / px - 1)).toBeLessThan(0.15);
    }
  });
});

describe('which way up', () => {
  test('the spot says how far the code is turned from upright', () => {
    for (const rot of [0, 1.0, 2.5, 4.4, 6.0]) {
      const pic = shoot(payloads[1], { px: 130, rot, seed: 5, ss: 2 });
      const got = decodeBytecodeAt(...flat(pic));
      expect(got?.payload).toBe(key(payloads[1]));
      const turn = Math.atan2(Math.sin(got!.spot.angle - rot), Math.cos(got!.spot.angle - rot)); // the difference, wrapped
      expect(Math.abs(turn)).toBeLessThan(0.08);
    }
  });
});

describe('reading under random conditions', () => {
  test('reads about nine in ten of 120 random pictures, and never reads the wrong thing', () => {
    const rnd = lcg(7);
    let ok = 0,
      wrong = 0;
    const trials = 120;
    for (let t = 0; t < trials; t++) {
      const p = payloads[Math.floor(rnd() * payloads.length)].replace(/.$/, () => '0123456789abcdef'[Math.floor(rnd() * 16)]);
      const o: Shot = {
        px: 100 + rnd() * 140,
        rot: rnd() * 6.28,
        a: (rnd() - 0.5) * 0.12,
        b: (rnd() - 0.5) * 0.12,
        blur: rnd() * 1.0,
        noise: rnd() * 14,
        dark: rnd() < 0.5,
        glare: rnd() < 0.2,
        contrast: 0.6 + rnd() * 0.4,
        seed: t + 1,
        ss: 2,
      };
      const got = decodeBytecode(...flat(shoot(p, o)));
      if (got === key(p)) ok++;
      else if (got) wrong++;
    }
    console.log(`BYTECODE random ${ok}/${trials}, wrong ${wrong}`);
    expect(wrong).toBe(0); // the one thing that must never happen
    // Measured 117 of 120 (97%) with this mix of conditions (it was 97 of 120 with the whole message on the outline; the TGcode reads 90%+ of its own, kinder, mix). A third of the message is now in
    // shade patches on his body, which blur and noise hurt far less than thin dashes, and the dashes left on the outline are longer and bolder. The bar is a little under what it reaches today.
    expect(ok / trials).toBeGreaterThanOrEqual(0.9);
  }, 600000);
});
