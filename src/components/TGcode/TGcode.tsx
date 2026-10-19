import { PAYLOAD, R_IN, R_LOGO, R_SMALL, FINDERS, DOTS, THICK, DASH, U, arcs as arcsOf, hairlines } from '@/lib/qr/tgCode/layout';
import styles from './TGcode.module.css';

// The portal's own circular code (see lib/qr/tgCode; the idea is Apple's App Clip codes, in Triton Gaming's colours): concentric rings of arcs (one cell of gap between them, always, and no tiny ones) with two ring marks at the top and a dot at each bottom corner, and the Triton logo
// on a solid disc in the middle. Drawn in the portal's ink on its card colour, so it flips with the light and dark theme while keeping the contrast the reader
// needs either way. Only the portal's Scan button reads it.
const RING_COLOUR = [styles.c0, styles.c1];   // the message rings alternate the portal's ink and blue (both dark enough to read, and light in the dark theme)
const FILL_COLOUR = [styles.f0, styles.f1];   // the filler arcs the scanner ignores: Triton yellow and light blue
const HAIR = 0.007;   // width of the fine lines between the rings
const CORNER = 0.5;   // the corner radius of an arc, as a share of its width (half: fully rounded ends)

export default function TGcode({ payload, size, className = '', label = 'Code for the portal’s Scan button' }: { payload: string; size?: number; className?: string; label?: string }) {
  if (!PAYLOAD.test(payload)) return null;
  // The geometry (where each arc starts and ends) is lib/qr/tgCode's `arcs`.
  // Filler is drawn first, so a message arc is never covered.
  const drawn = [...arcsOf(payload)].sort((x, y) => Number(y.fill) - Number(x.fill)).map(({ ring, a0, a1, fill }, i) => {
    const r = R_IN + (ring + 0.5) * THICK;
    const cls = (fill ? FILL_COLOUR : RING_COLOUR)[ring % 2];
    if (a1 - a0 >= 2 * Math.PI) return <circle key={i} r={r} fill="none" strokeWidth={DASH} className={`${cls} ${styles.band}`} />;
    const ro = r + DASH / 2, ri = r - DASH / 2, c = DASH * CORNER;
    const pt = (a: number, rad: number) => `${(rad * Math.cos(a)).toFixed(4)} ${(rad * Math.sin(a)).toFixed(4)}`;
    const dO = c / ro, dI = c / ri;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M ${pt(a0 + dO, ro)} A ${ro} ${ro} 0 ${large} 1 ${pt(a1 - dO, ro)} Q ${pt(a1, ro)} ${pt(a1, ro - c)} L ${pt(a1, ri + c)} Q ${pt(a1, ri)} ${pt(a1 - dI, ri)} A ${ri} ${ri} 0 ${large} 0 ${pt(a0 + dI, ri)} Q ${pt(a0, ri)} ${pt(a0, ri + c)} L ${pt(a0, ro - c)} Q ${pt(a0, ro)} ${pt(a0 + dO, ro)} Z`;
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
      {/* A fine line of colour in the space between each pair of rings (never where a cell is read, and never touching a mark). */}
      {hairlines().map(([k, a0, a1], i) => {
        const r = R_IN + k * THICK;
        return <path key={`h${i}`} d={`M ${(r * Math.cos(a0)).toFixed(4)} ${(r * Math.sin(a0)).toFixed(4)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(r * Math.cos(a1 - 1e-4)).toFixed(4)} ${(r * Math.sin(a1 - 1e-4)).toFixed(4)}`} fill="none" strokeWidth={HAIR} className={k % 2 ? styles.hair1 : styles.hair0} />;
      })}
      <g className={styles.dashes}>{drawn}</g>
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
