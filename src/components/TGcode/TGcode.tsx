import { PAYLOAD, R_IN, R_LOGO, R_SMALL, FINDERS, DOTS, THICK, DASH, U, SECTORS, dashRuns, endShift } from '@/lib/qr/tgCode/layout';
import styles from './TGcode.module.css';

// The portal's own circular code (see lib/qr/tgCode; the idea is Apple's App Clip codes, in Triton Gaming's colours): concentric rings of dashes with two ring marks at the top and a dot at each bottom corner, and the Triton logo
// on a solid disc in the middle. Drawn in the portal's ink on its card colour, so it flips with the light and dark theme while keeping the contrast the reader
// needs either way. Only the portal's Scan button reads it.
export default function TGcode({ payload, size, className = '', label = 'Code for the portal’s Scan button' }: { payload: string; size?: number; className?: string; label?: string }) {
  if (!PAYLOAD.test(payload)) return null;
  const delta = (2 * Math.PI) / SECTORS;
  const arcs = dashRuns(payload).map(([ring, s, e, fill], i) => {
    const r = R_IN + (ring + 0.5) * THICK;
    const inset = DASH / 2 / r;   // the round ends sit inside the run, so a dash fills exactly its cells
    const full = e - s + 1 >= SECTORS;
    const a0 = s * delta + inset - (full ? 0 : endShift(ring, s, 0)) * delta, a1 = (e + 1) * delta - inset + (full ? 0 : endShift(ring, e, 1)) * delta;   // arcs end a little differently from one another; the reader looks at the middle of a cell, which stays clear
    const p = (a: number) => `${(r * Math.cos(a)).toFixed(4)} ${(r * Math.sin(a)).toFixed(4)}`;
    // Square-ended dashes, like pixels of an arcade screen (Apple's are round). The message dashes are navy and (some) royal blue, which the scanner reads; the filler dashes
    // are Triton yellow and light blue, which it ignores.
    return <path key={i} d={`M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`} className={fill ? ((i + ring) % 3 === 0 ? styles.fillBlue : styles.fill) : (i * 7 + ring * 3 + s) % 4 === 0 ? styles.tone : undefined} />;
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
      <g className={styles.dashes} strokeWidth={DASH} strokeLinecap="square" fill="none">{arcs}</g>
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
