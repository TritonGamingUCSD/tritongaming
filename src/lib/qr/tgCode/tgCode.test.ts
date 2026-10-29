import { describe, expect, test } from 'vitest';
import { rsDecode, rsEncode } from './rs';
import {
  BLOCKS,
  DASH,
  EXT,
  NIBBLES,
  NSYM,
  PATTERN_COUNT,
  RINGS,
  SECTORS,
  THICK,
  arcs,
  dashGrid,
  dashRuns,
  markClearance,
  nibblesOf,
  patternCells,
  payloadFromNibbles,
} from './layout';
import { R_IN, R_OUT } from './marks';
import { decodeTGcode, decodeTGcodeAt } from './decode';
import { paint, type Shot } from './testCamera';

const payloads = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a', 'm9f8e7d6c5b4a', 't13579bdf0246'];
const key = (p: string) => p.slice(0, 9); // what a code carries: the kind and the first 8 hex digits
const flat = (p: { img: Uint8ClampedArray; size: number }): [Uint8ClampedArray, number, number] => [p.img, p.size, p.size];
const lcg = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

describe('repair bytes', () => {
  test('mend wrong bytes and known-bad bytes up to what the parity allows (2 per wrong, 1 per known-bad)', () => {
    const rnd = lcg(99);
    for (let t = 0; t < 400; t++) {
      const data = Array.from({ length: 5 }, () => Math.floor(rnd() * 256));
      const bytes = rsEncode(data, NSYM);
      const v = Math.floor(rnd() * 5); // unknown wrong bytes: 0..4
      const e = Math.floor(rnd() * (NSYM - 2 * v + 1)); // known-bad bytes: as many as is left
      const hit = new Set<number>();
      while (hit.size < v + e) hit.add(Math.floor(rnd() * 14));
      const all = [...hit];
      for (const p of all) bytes[p] ^= 1 + Math.floor(rnd() * 255);
      const erase = all.slice(0, e);
      expect(rsDecode(bytes, NSYM, erase)).toEqual(data);
    }
  });

  test('refuse (and never invent) a message when there is more damage than the parity can mend', () => {
    const rnd = lcg(5);
    let wrong = 0,
      mended = 0;
    for (let t = 0; t < 600; t++) {
      const data = Array.from({ length: 5 }, () => Math.floor(rnd() * 256));
      const bytes = rsEncode(data, NSYM);
      const hit = new Set<number>();
      const n = 7 + Math.floor(rnd() * 6);
      while (hit.size < n) hit.add(Math.floor(rnd() * 14));
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
  test('there is room for every block, and no cell sits so close to a mark that two machines could disagree about it', () => {
    expect(BLOCKS.length).toBe(NIBBLES);
    expect(PATTERN_COUNT).toBe(16);
    for (let r = 0; r < RINGS; r++) for (let s = 0; s < SECTORS[r]; s++) expect(Math.abs(markClearance(r, s))).toBeGreaterThan(1e-4);
  });

  test('the cells are about as wide as they are tall, even in the smallest ring', () => {
    for (let r = 0; r < RINGS; r++) {
      const width = (2 * Math.PI * (R_IN + (r + 0.5) * THICK)) / SECTORS[r];
      expect(width / THICK).toBeGreaterThan(0.8);
      expect(width / THICK).toBeLessThan(1.25);
    }
    expect(R_IN + RINGS * THICK).toBeCloseTo(R_OUT, 9);
  });

  test('half-bytes round-trip to the payload, for random keys of each kind', () => {
    const rnd = lcg(3);
    for (let t = 0; t < 300; t++) {
      const p = 'mtr'[t % 3] + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
      expect(payloadFromNibbles(nibblesOf(p)!)).toBe(key(p));
    }
  });

  test('a meeting, a ticket and a reward never share a TGcode, even with the same key', () => {
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

  test('in the message a gap is always exactly one cell: never two gaps in a row, and an arc is never shorter than two cells', () => {
    const rnd = lcg(11);
    const inBlock = new Set<number>();
    for (const b of BLOCKS) for (const [r, s] of b) inBlock.add(r * 100 + s);
    for (let t = 0; t < 200; t++) {
      const p = 'mtr'[t % 3] + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
      const g = dashGrid(p)!;
      for (let r = 0; r < RINGS; r++) {
        const S = SECTORS[r];
        for (let s = 0; s < S; s++) {
          const n = (s + 1) % S;
          if (inBlock.has(r * 100 + s) && inBlock.has(r * 100 + n)) expect(g[r][s] || g[r][n]).toBe(true);
        }
      }
    }
  });

  test('every arc is drawn with the same gap beside it, whatever the key', () => {
    const rnd = lcg(21);
    for (let t = 0; t < 40; t++) {
      const p = 'mtr'[t % 3] + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
      const list = arcs(p);
      for (const ring of Array.from({ length: RINGS }, (_, i) => i)) {
        const delta = (2 * Math.PI) / SECTORS[ring];
        const mine = list.filter((a) => a.ring === ring && a.a1 - a.a0 < 2 * Math.PI);
        for (const a of mine) {
          // The nearest start after this arc's end is one cell minus the two reaches (or a mark's zone).
          const gap = (x: number) => (((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / delta;
          const next = mine.map((b) => gap(b.a0 - a.a1)).filter((g) => g > 1e-9 && g < 1.5);
          for (const g of next) expect(Math.abs(g - (1 - 2 * EXT))).toBeLessThan(1e-6);
        }
      }
    }
    expect(DASH).toBeLessThan(THICK);
  });

  test('no arc is shorter than two cells, and the blocks hold exactly the message', () => {
    const rnd = lcg(31);
    for (let t = 0; t < 120; t++) {
      const p = 'mtr'[t % 3] + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(rnd() * 16)]).join('');
      for (const [, s, e] of dashRuns(p)) expect(e - s + 1).toBeGreaterThanOrEqual(2);
    }
    expect(BLOCKS.reduce((n, b) => n + b.length, 0)).toBe(NIBBLES * 10);
  });

  test('a block pattern read with a few cells wrong is still a valid arc pattern or is mended by the repair', () => {
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
  const cases: { name: string; o: Shot }[] = [];
  for (const dark of [false, true])
    for (const px of [45, 70, 120, 260])
      for (const rot of [0, 0.5, 1.3, 2.2, 3.14, 4.4, 5.6]) cases.push({ name: `${dark ? 'dark' : 'light'} r${px} turn ${rot}`, o: { px, rot, dark, ss: px > 150 ? 1 : 2 } });
  test.each(cases)('reads a clean picture: $name', ({ o }) => {
    payloads.forEach((p, i) => expect(decodeTGcode(...flat(paint(p, { ...o, seed: i + 1 })))).toBe(key(p)));
  });

  const rough: { name: string; o: Shot }[] = [];
  for (const dark of [false, true])
    for (const [a, b] of [
      [0.15, 0],
      [-0.15, 0.1],
      [0, 0.2],
      [0.12, -0.15],
    ])
      rough.push({ name: `${dark ? 'dark' : 'light'} tilt ${a},${b}`, o: { px: 90, rot: 0.9, a, b, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} blur + noise`, o: { px: 70, rot: 2.0, blur: 1.0, noise: 14, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} glare`, o: { px: 90, rot: 4.0, glare: true, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} a thumb over the edge`, o: { px: 90, rot: 1.0, thumb: { x: 0.45, y: 0.5, r: 0.18 }, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} washed out`, o: { px: 80, rot: 2.5, contrast: 0.45, noise: 8, dark } });
  test.each(rough)('reads a rough picture: $name', ({ o }) => {
    let ok = 0;
    payloads.forEach((p, i) => {
      if (decodeTGcode(...flat(paint(p, { ...o, seed: i + 3 }))) === key(p)) ok++;
    });
    expect(ok).toBeGreaterThanOrEqual(payloads.length - 1);
  });

  test('does not invent a code from nothing', () => {
    const size = 300;
    const noise = new Uint8ClampedArray(size * size);
    let s = 5;
    for (let i = 0; i < noise.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      noise[i] = s >>> 24;
    }
    expect(decodeTGcode(noise, size, size)).toBeNull();
    expect(decodeTGcode(new Uint8ClampedArray(size * size).fill(200), size, size)).toBeNull();
  });

  test('reports where the code is: its centre and size, turned, tilted, light or dark', () => {
    for (const [px, rot, a, b, dark] of [
      [110, 0, 0, 0, false],
      [80, 1.3, 0.05, -0.04, true],
      [150, 4.4, -0.06, 0.05, false],
      [50, 2.2, 0, 0, true],
    ] as const) {
      const pic = paint(payloads[1], { px, rot, a, b, dark, seed: 5, ss: 2 });
      const got = decodeTGcodeAt(...flat(pic));
      expect(got?.payload).toBe(key(payloads[1]));
      expect(Math.hypot(got!.spot.x - pic.size / 2, got!.spot.y - pic.size / 2)).toBeLessThan(px * 0.06);
      expect(Math.abs(got!.spot.r / (px * 0.88) - 1)).toBeLessThan(0.1);
    }
  });

  test('codes of the first format still read', () => {
    for (const [i, p] of payloads.entries()) {
      for (const dark of [false, true]) expect(decodeTGcode(...flat(paint(p, { px: 100, rot: 0.7 * (i + 1), dark, seed: i + 1, ss: 2 }, 'legacy')))).toBe(p);
    }
  });
});

describe('reading under random conditions', () => {
  test('reads nearly all of 150 random pictures, and never reads the wrong thing', () => {
    const rnd = lcg(7);
    let ok = 0,
      wrong = 0;
    const trials = 150;
    for (let t = 0; t < trials; t++) {
      const p = payloads[Math.floor(rnd() * payloads.length)].replace(/.$/, () => '0123456789abcdef'[Math.floor(rnd() * 16)]);
      const o: Shot = {
        px: 50 + rnd() * 160,
        rot: rnd() * 6.28,
        a: (rnd() - 0.5) * 0.3,
        b: (rnd() - 0.5) * 0.3,
        blur: rnd() * 1.3,
        noise: rnd() * 25,
        dark: rnd() < 0.5,
        glare: rnd() < 0.2,
        contrast: 0.6 + rnd() * 0.4,
        seed: t + 1,
        ss: 2,
      };
      const got = decodeTGcode(...flat(paint(p, o)));
      if (got === key(p)) ok++;
      else if (got) wrong++;
    }
    console.log(`TGCODE random ${ok}/${trials}, wrong ${wrong}`);
    expect(wrong).toBe(0);
    expect(ok / trials).toBeGreaterThanOrEqual(0.9);
  }, 300000);
});
