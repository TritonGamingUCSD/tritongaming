// Reed–Solomon over GF(256) (primitive polynomial 0x11d, first root alpha^0), written after the "Reed–Solomon codes for coders" reference.
// Polynomials are arrays with the highest power first. Small and dependency-free: it is what lets a ring code still read with some dashes hidden or smudged.

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
const div = (a: number, b: number) => { if (b === 0) throw new Error('div0'); return a === 0 ? 0 : EXP[(LOG[a] + 255 - LOG[b]) % 255]; };
const pow = (x: number, p: number) => EXP[(((LOG[x] * p) % 255) + 255) % 255];
const inverse = (x: number) => EXP[255 - LOG[x]];

const polyScale = (p: number[], x: number) => p.map((c) => mul(c, x));
function polyAdd(p: number[], q: number[]) {
  const r = new Array<number>(Math.max(p.length, q.length)).fill(0);
  for (let i = 0; i < p.length; i++) r[i + r.length - p.length] = p[i];
  for (let i = 0; i < q.length; i++) r[i + r.length - q.length] ^= q[i];
  return r;
}
function polyMul(p: number[], q: number[]) {
  const r = new Array<number>(p.length + q.length - 1).fill(0);
  for (let j = 0; j < q.length; j++) for (let i = 0; i < p.length; i++) r[i + j] ^= mul(p[i], q[j]);
  return r;
}
function polyEval(p: number[], x: number) {
  let y = p[0];
  for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i];
  return y;
}
function polyDiv(dividend: number[], divisor: number[]): { q: number[]; r: number[] } {
  const out = [...dividend];
  for (let i = 0; i < dividend.length - (divisor.length - 1); i++) {
    const coef = out[i];
    if (coef !== 0) for (let j = 1; j < divisor.length; j++) if (divisor[j] !== 0) out[i + j] ^= mul(divisor[j], coef);
  }
  const sep = -(divisor.length - 1);
  return { q: out.slice(0, sep), r: out.slice(sep) };
}

function generator(nsym: number) {
  let g = [1];
  for (let i = 0; i < nsym; i++) g = polyMul(g, [1, EXP[i]]);
  return g;
}

/** data followed by nsym parity bytes. */
export function rsEncode(data: number[], nsym: number): number[] {
  const g = generator(nsym);
  const out = [...data, ...new Array<number>(nsym).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = out[i];
    if (coef !== 0) for (let j = 1; j < g.length; j++) out[i + j] ^= mul(g[j], coef);
  }
  return [...data, ...out.slice(data.length)];
}

const syndromes = (msg: number[], nsym: number) => { const s: number[] = []; for (let i = 0; i < nsym; i++) s.push(polyEval(msg, EXP[i])); return s; };

function errorLocator(synd: number[], nsym: number): number[] {
  let errLoc = [1], oldLoc = [1];
  for (let i = 0; i < nsym; i++) {
    let delta = synd[i];
    for (let j = 1; j < errLoc.length; j++) delta ^= mul(errLoc[errLoc.length - 1 - j], synd[i - j]);
    oldLoc = [...oldLoc, 0];
    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const newLoc = polyScale(oldLoc, delta);
        oldLoc = polyScale(errLoc, inverse(delta));
        errLoc = newLoc;
      }
      errLoc = polyAdd(errLoc, polyScale(oldLoc, delta));
    }
  }
  while (errLoc.length && errLoc[0] === 0) errLoc.shift();
  if ((errLoc.length - 1) * 2 > nsym) throw new Error('too many errors');
  return errLoc;
}

function findErrors(errLocRev: number[], n: number): number[] {
  const errs = errLocRev.length - 1, pos: number[] = [];
  for (let i = 0; i < n; i++) if (polyEval(errLocRev, pow(2, i)) === 0) pos.push(n - 1 - i);
  if (pos.length !== errs) throw new Error('could not locate errors');
  return pos;
}

function correctErrata(msg: number[], synd: number[], errPos: number[]): number[] {
  const coefPos = errPos.map((p) => msg.length - 1 - p);
  let errLoc = [1];
  for (const i of coefPos) errLoc = polyMul(errLoc, polyAdd([1], [pow(2, i), 0]));
  // Error evaluator: (reversed syndromes, with a leading 0) * locator, modulo x^(len).
  const syndRev = [0, ...synd].reverse();
  const { r } = polyDiv(polyMul(syndRev, errLoc), [1, ...new Array<number>(errLoc.length).fill(0)]);
  const errEval = r;
  const X = coefPos.map((c) => pow(2, -(255 - c)));
  const E = new Array<number>(msg.length).fill(0);
  X.forEach((Xi, i) => {
    const XiInv = inverse(Xi);
    let prime = 1;
    X.forEach((Xj, j) => { if (j !== i) prime = mul(prime, 1 ^ mul(XiInv, Xj)); });
    if (prime === 0) throw new Error('bad locator');
    let y = polyEval([...errEval].reverse().reverse(), XiInv);
    y = mul(pow(Xi, 1), y);
    E[errPos[i]] = div(y, prime);
  });
  return polyAdd(msg, E);
}

/** The data bytes, or null when the damage is beyond what the parity can repair. */
export function rsDecode(msg: number[], nsym: number): number[] | null {
  try {
    const synd = syndromes(msg, nsym);
    if (synd.every((s) => s === 0)) return msg.slice(0, msg.length - nsym);
    const errLoc = errorLocator(synd, nsym);
    const pos = findErrors([...errLoc].reverse(), msg.length);
    const fixed = correctErrata(msg, synd, pos);
    if (!syndromes(fixed, nsym).every((s) => s === 0)) return null;
    return fixed.slice(0, fixed.length - nsym);
  } catch { return null; }
}
