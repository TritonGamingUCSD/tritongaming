import { DATA_CELLS, R_OUT, DOTS, FINDERS, R_SMALL, SPAN, U, cellCenter, payloadFromBits } from './legacyLayout';
import { type Finder, findFinders, pickPairs, findDot, homography, binarize } from './find';

// Reads a TGcode of the first format out of a camera picture (grey values, width × height). No library: it finds the three finder marks the way a QR reader does, works out
// where the code sits (position, size, turn, and a little tilt from the three marks), reads each cell where the dash would be, and lets the repair bytes
// settle what a blurred or glared cell got wrong. Light marks on a dark plate (the portal's dark theme) read just as well as dark on light.

/** Reads the cells given where the top-left (L) and top-right (R) ring marks are. Straightened by the two bottom dots when both are found, otherwise by the two marks alone. */
function readCells(
  gray: Uint8ClampedArray | Uint8Array,
  w: number,
  h: number,
  L: Finder,
  R: Finder,
  bin: Uint8Array,
  straighten: boolean,
): { cells: number[]; map: (x: number, y: number) => { x: number; y: number } } | null {
  // Code units → picture as a turn and a scale fixed by the two marks.
  const dx = (R.x - L.x) / SPAN,
    dy = (R.y - L.y) / SPAN; // the picture's step for one code unit along "right"; "down" is that turned a quarter
  const similar = (x: number, y: number) => {
    const fx = x - FINDERS.tl.x,
      fy = y - FINDERS.tl.y;
    return { x: L.x + fx * dx - fy * dy, y: L.y + fx * dy + fy * dx };
  };
  const scale = Math.hypot(dx, dy); // pixels per code unit
  let map = similar;
  if (straighten) {
    const bl = findDot(bin, w, h, similar(DOTS.bl.x, DOTS.bl.y), R_SMALL * scale),
      br = findDot(bin, w, h, similar(DOTS.br.x, DOTS.br.y), R_SMALL * scale);
    if (!bl || !br) return null;
    const proj = homography([FINDERS.tl, FINDERS.tr, DOTS.bl, DOTS.br], [L, R, bl, br]);
    if (!proj) return null;
    map = proj;
  }
  const grab = (x: number, y: number) => {
    const p = map(x, y);
    const px = Math.round(p.x),
      py = Math.round(p.y);
    if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return -1;
    let s = 0;
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) s += gray[(py + yy) * w + px + xx];
    return s / 9;
  };
  // Reference levels from the marks themselves: the middle of a mark is a "mark" colour, the gap ring around it is the plate colour.
  let mark = 0,
    plate = 0,
    nm = 0,
    np = 0;
  for (const f of [FINDERS.tl, FINDERS.tr]) {
    const m = grab(f.x, f.y);
    if (m < 0) return null;
    mark += m;
    nm++;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const p = grab(f.x + 2 * U * Math.cos(a), f.y + 2 * U * Math.sin(a));
      if (p >= 0) {
        plate += p;
        np++;
      }
    }
  }
  if (!nm || !np) return null;
  mark /= nm;
  plate /= np;
  if (Math.abs(plate - mark) < 25) return null;
  const thr = (mark + plate) / 2,
    darkMarks = mark < plate;
  const cells = new Array<number>(DATA_CELLS.length).fill(0);
  for (let i = 0; i < DATA_CELLS.length; i++) {
    const c = cellCenter(DATA_CELLS[i][0], DATA_CELLS[i][1]);
    let acc = 0,
      n = 0;
    for (const [ox, oy] of [
      [0, 0],
      [0.012, 0],
      [-0.012, 0],
      [0, 0.012],
      [0, -0.012],
    ]) {
      const v = grab(c.x + ox, c.y + oy);
      if (v >= 0) {
        acc += v;
        n++;
      }
    }
    if (!n) return null;
    const v = acc / n;
    cells[i] = (darkMarks ? v < thr : v > thr) ? 1 : 0;
  }
  return { cells, map };
}

/** One try at reading a first-format TGcode, given where the two top ring marks are: what it says and how code units map into the picture, or null. */
export function readLegacy(gray: Uint8ClampedArray | Uint8Array, w: number, h: number, L: Finder, R: Finder, bin: Uint8Array, straighten: boolean) {
  const read = readCells(gray, w, h, L, R, bin, straighten);
  const payload = read && payloadFromBits(read.cells);
  return payload && read ? { payload, map: read.map } : null;
}
