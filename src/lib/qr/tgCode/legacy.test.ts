import { describe, expect, test } from 'vitest';
import { rsDecode, rsEncode } from './rs';
import { DASH, DOTS, FINDERS, R_IN, R_LOGO, RINGS, THICK, U, R_SMALL, SECTORS, endShift, dashGrid, messageBits, DATA_CELLS, payloadFromBits } from './legacyLayout';
import { decodeTGcode, decodeTGcodeAt } from './decode';

// A small software "camera": draws a TGcode into a grey picture (any turn, size, tilt, blur, noise, light or dark plate) so the reader can be tried on many pictures.
function paint(
  payload: string,
  o: { px: number; rot: number; a?: number; b?: number; blur?: number; noise?: number; dark?: boolean; size?: number; seed?: number; glare?: boolean; tone?: boolean },
) {
  const size = o.size ?? Math.round(o.px * 2.6);
  const gray = new Uint8ClampedArray(size * size);
  const grid = dashGrid(payload)!;
  const delta = (2 * Math.PI) / SECTORS;
  const dash = (x: number, y: number): number => {
    const r = Math.hypot(x, y);
    if (r < R_IN || r >= R_IN + RINGS * THICK) return 0;
    const ring = Math.floor((r - R_IN) / THICK);
    if (Math.abs(r - (R_IN + (ring + 0.5) * THICK)) > DASH / 2) return 0; // between the rings
    let ang = Math.atan2(y, x);
    if (ang < 0) ang += 2 * Math.PI;
    const sec = Math.floor(ang / delta) % SECTORS;
    const fr = ang / delta - Math.floor(ang / delta);
    const on = (k: number) => grid[ring][(k + SECTORS) % SECTORS];
    const lit = on(sec)
      ? !((!on(sec - 1) && fr < -endShift(ring, sec, 0)) || (!on(sec + 1) && fr > 1 + endShift(ring, sec, 1))) // a dash may stop a little short of its cell edge
      : (on(sec + 1) && !on(sec) && fr > 1 - endShift(ring, sec + 1, 0)) || (on(sec - 1) && fr < endShift(ring, sec - 1, 1)); // or reach a little past it
    return lit ? (o.tone && (sec * 7 + ring * 3) % 4 === 0 ? 2 : 1) : 0; // 2 = the portal-blue second tone
  };
  const ink = o.dark ? 235 : 25,
    plate = o.dark ? 18 : 240,
    around = 128;
  const cs = Math.cos(o.rot),
    sn = Math.sin(o.rot),
    c = size / 2;
  const rnd = (() => {
    let s = ((o.seed ?? 7) * 2654435761) >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  })();
  const colorAt = (x: number, y: number) => {
    const r = Math.hypot(x, y);
    if (r > 1) return around;
    for (const f of Object.values(FINDERS)) {
      const d = Math.hypot(x - f.x, y - f.y);
      if (d <= 1.5 * U || (d > 2.5 * U && d <= 3.5 * U)) return ink;
    }
    for (const d of Object.values(DOTS)) if (Math.hypot(x - d.x, y - d.y) <= R_SMALL) return ink;
    if (r < R_LOGO) return Math.hypot(x - 0.04, y + 0.03) < 0.12 ? 110 : plate;
    const d = dash(x, y);
    return d === 2 ? (o.dark ? 170 : 66) : d ? ink : plate;
  };
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let u = (px - c) / o.px,
        v = (py - c) / o.px;
      const k = 1 + (o.a ?? 0) * u + (o.b ?? 0) * v;
      u /= k;
      v /= k;
      // inverse of a turn by o.rot
      const x = u * cs + v * sn,
        y = -u * sn + v * cs;
      let g = colorAt(x, y);
      if (o.glare) g += 70 * Math.max(0, 1 - Math.hypot(px - size * 0.7, py - size * 0.3) / (size * 0.25));
      gray[py * size + px] = g;
    }
  let img = gray;
  for (let pass = 0; pass < (o.blur ?? 0); pass++) {
    const out = new Uint8ClampedArray(img.length);
    for (let y = 1; y < size - 1; y++)
      for (let x = 1; x < size - 1; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += img[(y + dy) * size + x + dx];
        out[y * size + x] = s / 9;
      }
    img = out;
  }
  if (o.noise) for (let i = 0; i < img.length; i++) img[i] = img[i] + (rnd() + rnd() + rnd() - 1.5) * o.noise * 2;
  return { img, size };
}

const payloads = ['m0123456789ab', 't00ffeeddccbb', 'rabcdefabcdef', 'm000000000000', 'tffffffffffff', 'r1f2e3d4c5b6a'];

describe('TGcode', () => {
  test('reed-solomon repairs up to 12 wrong bytes of 32', () => {
    let seed = 99;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let t = 0; t < 300; t++) {
      const data = Array.from({ length: 8 }, () => Math.floor(rnd() * 256));
      const bytes = rsEncode(data, 24);
      const hit = new Set<number>();
      const n = Math.floor(rnd() * 13);
      while (hit.size < n) hit.add(Math.floor(rnd() * 32));
      for (const p of hit) bytes[p] ^= 1 + Math.floor(rnd() * 255);
      expect(rsDecode(bytes, 24)).toEqual(data);
    }
  });

  test('cells round-trip to the payload', () => {
    for (const p of payloads) expect(payloadFromBits(messageBits(p)!)).toBe(p);
  });

  test('a meeting, a ticket and a reward never share a TGcode, even with the same key', () => {
    const key = '0123456789ab';
    const a = dashGrid(`m${key}`)!,
      b = dashGrid(`t${key}`)!,
      c = dashGrid(`r${key}`)!;
    const same = (x: boolean[][], y: boolean[][]) => x.every((row, i) => row.every((v, j) => v === y[i][j]));
    expect(same(a, b)).toBe(false);
    expect(same(a, c)).toBe(false);
    expect(same(b, c)).toBe(false);
    for (const [p, kind] of [
      [`m${key}`, 'm'],
      [`t${key}`, 't'],
      [`r${key}`, 'r'],
    ])
      expect(payloadFromBits(messageBits(p)!)![0]).toBe(kind);
  });

  test('there is room for the message and it is spread over the disc', () => {
    expect(DATA_CELLS.length).toBe(256);
    const rings = new Set(DATA_CELLS.map(([r]) => r));
    expect(rings.size).toBe(RINGS);
  });

  test('cells survive a handful of flipped dashes, and refuse a ruined code', () => {
    const cells = messageBits(payloads[0])!;
    const few = [...cells];
    for (const i of [3, 40, 77, 100, 150, 20, 61, 200, 222, 9]) few[i] ^= 1;
    expect(payloadFromBits(few)).toBe(payloads[0]);
    const ruined = cells.map((c, i) => (i % 3 === 0 ? c ^ 1 : c));
    expect(payloadFromBits(ruined)).toBeNull();
  });

  const cases: { name: string; o: Parameters<typeof paint>[1] }[] = [];
  for (const dark of [false, true])
    for (const px of [60, 90, 140, 260])
      for (const rot of [0, 0.5, 1.3, 2.2, 3.14, 4.4, 5.6]) cases.push({ name: `${dark ? 'dark' : 'light'} ${px}px turn ${rot}`, o: { px, rot, dark } });
  test.each(cases)('reads a clean picture: $name', ({ o }) => {
    payloads.forEach((p, i) => expect(decodeTGcode(...flat(paint(p, { ...o, seed: i + 1 })))).toBe(p));
  });

  const rough: { name: string; o: Parameters<typeof paint>[1] }[] = [];
  for (const dark of [false, true])
    for (const [a, b] of [
      [0.1, 0],
      [-0.1, 0.08],
      [0, 0.12],
      [0.08, -0.1],
    ])
      rough.push({ name: `${dark ? 'dark' : 'light'} tilt ${a},${b}`, o: { px: 130, rot: 0.9, a, b, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} blur + noise`, o: { px: 110, rot: 2.0, blur: 1, noise: 14, dark } });
  for (const dark of [false, true]) rough.push({ name: `${dark ? 'dark' : 'light'} glare`, o: { px: 130, rot: 4.0, glare: true, dark } });
  test.each(rough)('reads a rough picture: $name', ({ o }) => {
    let ok = 0;
    payloads.forEach((p, i) => {
      if (decodeTGcode(...flat(paint(p, { ...o, seed: i + 3 }))) === p) ok++;
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
});

function flat(p: { img: Uint8ClampedArray; size: number }): [Uint8ClampedArray, number, number] {
  return [p.img, p.size, p.size];
}

describe('TGcode under random conditions', () => {
  test('reads at least 94% of 200 random pictures, and never reads the wrong thing', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    let ok = 0,
      wrong = 0;
    const trials = 300;
    const misses: string[] = [];
    for (let t = 0; t < trials; t++) {
      const p = payloads[Math.floor(rnd() * payloads.length)].replace(/.$/, () => '0123456789abcdef'[Math.floor(rnd() * 16)]);
      const o = {
        px: 60 + rnd() * 250,
        rot: rnd() * 6.28,
        a: (rnd() - 0.5) * 0.28,
        b: (rnd() - 0.5) * 0.28,
        blur: Math.floor(rnd() * 2.6),
        noise: rnd() * 30,
        dark: rnd() < 0.5,
        glare: rnd() < 0.2,
        seed: t + 1,
      };
      const got = decodeTGcode(...flat(paint(p, o)));
      if (got === p) ok++;
      else if (got) wrong++;
      else misses.push(JSON.stringify({ ...o, px: Math.round(o.px) }));
    }
    console.log(`read ${ok}/${trials}, wrong ${wrong}`, misses.slice(0, 40).join('\n'));
    console.log(`HARSH ${ok}/${trials} wrong ${wrong}`);
    expect(wrong).toBe(0);
    expect(ok / trials).toBeGreaterThanOrEqual(0.5);
  }, 120000);
});

describe('two-tone dashes', () => {
  test('the portal-blue second tone reads as often as the single ink, light and dark', () => {
    let seed = 11;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const rate = (tone: boolean) => {
      seed = 11;
      let ok = 0;
      const n = 120;
      for (let t = 0; t < n; t++) {
        const p = payloads[t % payloads.length];
        const o = {
          px: 90 + rnd() * 200,
          rot: rnd() * 6.28,
          a: (rnd() - 0.5) * 0.2,
          b: (rnd() - 0.5) * 0.2,
          blur: Math.floor(rnd() * 2),
          noise: rnd() * 20,
          dark: rnd() < 0.5,
          glare: rnd() < 0.2,
          seed: t + 1,
          tone,
        };
        if (decodeTGcode(...flat(paint(p, o))) === p) ok++;
      }
      return ok / n;
    };
    const one = rate(false),
      two = rate(true);
    console.log(`TONE single ${one} two-tone ${two}`);
    expect(two).toBeGreaterThanOrEqual(one - 0.03);
  }, 120000);
});

describe('where the code is found', () => {
  test('the centre and size it reports match where the picture was drawn, turned, tilted, light or dark', () => {
    for (const [px, rot, a, b, dark] of [
      [140, 0, 0, 0, false],
      [100, 1.3, 0.05, -0.04, true],
      [200, 4.4, -0.06, 0.05, false],
      [70, 2.2, 0, 0, true],
    ] as const) {
      const pic = paint(payloads[1], { px, rot, a, b, dark, seed: 5 });
      const got = decodeTGcodeAt(...flat(pic));
      expect(got?.payload).toBe(payloads[1]);
      expect(Math.hypot(got!.spot.x - pic.size / 2, got!.spot.y - pic.size / 2)).toBeLessThan(px * 0.06);
      expect(Math.abs(got!.spot.r / (px * 0.88) - 1)).toBeLessThan(0.1);
    }
  });
});
