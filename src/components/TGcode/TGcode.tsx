import { PAYLOAD, R_IN, R_LOGO, R_SMALL, FINDERS, DOTS, THICK, DASH, U, SECTORS, dashRuns, endShift } from '@/lib/qr/tgCode/layout';
import styles from './TGcode.module.css';

// The portal's own circular code (see lib/qr/tgCode; the idea is Apple's App Clip codes, in Triton Gaming's colours): concentric rings of dashes with two ring marks at the top and a dot at each bottom corner, and the Triton logo
// on a solid disc in the middle. Drawn in the portal's ink on its card colour, so it flips with the light and dark theme while keeping the contrast the reader
// needs either way. Only the portal's Scan button reads it.
const FILL_BY_RING = [styles.fill, styles.fillBlue, styles.tone];   // the message dashes are all navy; the filler the scanner ignores takes one colour per ring
const FILL_WIDTH = DASH * 0.72;
const CORNER = 0.3;   // the corner radius of a dash, as a share of its width

export default function TGcode({ payload, size, className = '', label = 'Code for the portal’s Scan button' }: { payload: string; size?: number; className?: string; label?: string }) {
  if (!PAYLOAD.test(payload)) return null;
  const delta = (2 * Math.PI) / SECTORS;
  const arcs = [...dashRuns(payload)].sort((x, y) => Number(y[3]) - Number(x[3])).map(([ring, s, e, fill], i) => {
    const r = R_IN + (ring + 0.5) * THICK;
    const w = fill ? FILL_WIDTH : DASH;   // filler is a little thinner than the message dashes, so the message stands out
    const full = e - s + 1 >= SECTORS;
    const cls = fill ? FILL_BY_RING[ring % FILL_BY_RING.length] : undefined;
    if (full) return <circle key={i} r={r} fill="none" strokeWidth={w} className={cls ? `${cls} ${styles.band}` : styles.band} />;
    // Arcs end a little differently from one another (one of three set lengths); the reader looks at the middle of a cell, which stays clear.
    const A0 = (s - endShift(ring, s, 0)) * delta, A1 = (e + 1 + endShift(ring, e, 1)) * delta;
    const ro = r + w / 2, ri = r - w / 2, c = w * CORNER;
    const pt = (a: number, rad: number) => `${(rad * Math.cos(a)).toFixed(4)} ${(rad * Math.sin(a)).toFixed(4)}`;
    const dO = c / ro, dI = c / ri;
    const large = A1 - A0 > Math.PI ? 1 : 0;
    // Every dash is a band of an arc with the same small corner radius all round (filler first, so a message dash that reaches into its neighbour stays on top).
    const d = `M ${pt(A0 + dO, ro)} A ${ro} ${ro} 0 ${large} 1 ${pt(A1 - dO, ro)} Q ${pt(A1, ro)} ${pt(A1, ro - c)} L ${pt(A1, ri + c)} Q ${pt(A1, ri)} ${pt(A1 - dI, ri)} A ${ri} ${ri} 0 ${large} 0 ${pt(A0 + dI, ri)} Q ${pt(A0, ri)} ${pt(A0, ri + c)} L ${pt(A0, ro - c)} Q ${pt(A0, ro)} ${pt(A0 + dO, ro)} Z`;
    return <path key={i} d={d} className={cls} />;
  });
  const finder = (c: { x: number; y: number }, k: string) => (
    <g key={k}>
      <circle cx={c.x} cy={c.y} r={1.5 * U} className={styles.solid} />
      <circle cx={c.x} cy={c.y} r={3 * U} className={styles.ringMark} strokeWidth={U} />
    </g>
  );
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} className={`${styles.code} ${className}`} role="img" aria-label={label}>
      <circle r="1" className={styles.plate} />
      <circle r="0.972" className={styles.rim} strokeWidth={0.02} />
      <circle r="0.925" className={styles.rimLine} strokeWidth={0.006} />
      <g className={styles.dashes}>{arcs}</g>
      {finder(FINDERS.tl, 'tl')}{finder(FINDERS.tr, 'tr')}
      <circle cx={DOTS.bl.x} cy={DOTS.bl.y} r={R_SMALL} className={styles.solid} />
      <circle cx={DOTS.br.x} cy={DOTS.br.y} r={R_SMALL} className={styles.solid} />
      <circle r={(R_LOGO + R_IN) / 2} className={styles.accent} strokeWidth={0.012} />
      <circle r={R_LOGO} className={styles.solid} />
      <circle r={R_LOGO * 0.76} className={styles.plate} />
      <image href="/logos/tg_logo.png" x={-R_LOGO * 0.62} y={-R_LOGO * 0.62} width={R_LOGO * 1.24} height={R_LOGO * 1.24} preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
