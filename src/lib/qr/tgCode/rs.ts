// Reed–Solomon over GF(256) (primitive polynomial 0x11d, first root alpha^0), written after the "Reed–Solomon codes for coders" reference.
// Polynomials are arrays with the highest power first. Small and dependency-free: it is what lets a TGcode still read with some dashes hidden or smudged.

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

function errorLocator(synd: number[], nsym: number, eraseCount = 0): number[] {
  let errLoc = [1], oldLoc = [1];
  for (let i = 0; i < nsym - eraseCount; i++) {
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
  if ((errLoc.length - 1 - eraseCount) * 2 + eraseCount > nsym) throw new Error('too many errors');
  return errLoc;
}

/** The syndromes with the known-bad positions taken out, so the search for further wrong bytes only has to find those. */
function forneySyndromes(synd: number[], erase: number[], n: number): number[] {
  const f = [...synd];
  for (const p of erase) {
    const x = pow(2, n - 1 - p);
    for (let j = 0; j < f.length - 1; j++) f[j] = mul(f[j], x) ^ f[j + 1];
    f.pop();
  }
  return f;
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

/** The data bytes, or null when the damage is beyond what the parity can repair. `erase` lists positions known to be unreliable (a wrong byte costs two parity
 *  bytes to find and fix, a known-bad one costs only one); `maxFix` caps how many unknown wrong bytes may be repaired, so a hopeless read cannot pass as a repaired one. */
export function rsDecode(msg: number[], nsym: number, erase: number[] = [], maxFix = Math.floor(nsym / 2)): number[] | null {
  try {
    if (erase.length > nsym) return null;
    const work = [...msg];
    for (const p of erase) work[p] = 0;
    const synd = syndromes(work, nsym);
    if (synd.every((s) => s === 0)) return work.slice(0, work.length - nsym);
    const fsynd = forneySyndromes(synd, erase, work.length);
    const errLoc = errorLocator(fsynd, nsym, erase.length);
    if (errLoc.length - 1 > maxFix) return null;
    const pos = findErrors([...errLoc].reverse(), work.length);
    const fixed = correctErrata(work, synd, [...erase, ...pos]);
    if (!syndromes(fixed, nsym).every((s) => s === 0)) return null;
    return fixed.slice(0, fixed.length - nsym);
  } catch { return null; }
}
