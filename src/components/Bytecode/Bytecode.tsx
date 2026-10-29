import { drawing, PAYLOAD, LINE_W, DASH, FINDERS, DOTS, R_SMALL } from '@/lib/qr/byteCode/layout';
import { REGIONS, EYES, DOTS_OF_INK } from '@/lib/qr/byteCode/byteArt';
import styles from './Bytecode.module.css';

// The portal's cute code: the TGcode's message (see lib/qr/byteCode) written into Byte, the Triton Gaming mascot, drawn as he is. Parts of his own line work (and bars across his
// flat areas) are broken into dashes that carry the message; his own eyes (the pill and the X) are the two marks that say where the code is and which way up, and his feet carry the two small dots that straighten a tilted one. Only the portal's Scan button reads it.
const line = (pts: [number, number][]) => `M${pts.map((p) => p.join(' ')).join('L')}`;

export default function Bytecode({
  payload,
  size,
  className = '',
  label = 'Code for the portal’s Scan button',
}: {
  payload: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  if (!PAYLOAD.test(payload)) return null;
  const art = drawing(payload);
  if (!art) return null;
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} className={`${styles.code} ${className}`} role="img" aria-label={label}>
      <defs>
        <radialGradient id="bytecode-glow">
          <stop offset="0.45" className={styles.glowA} />
          <stop offset="1" className={styles.glowB} />
        </radialGradient>
      </defs>
      <rect x="-1" y="-1" width="2" height="2" className={styles.plate} />
      {REGIONS.map((r, i) => (
        <path key={i} d={r.d} className={styles[`c${r.col}` as 'c2']} />
      ))}
      {DOTS_OF_INK.map((r, i) => (
        <path key={i} d={r.d} className={styles.ink} />
      ))}
      <g className={styles.line}>
        <path d={art.solid.map(line).join('')} strokeWidth={LINE_W} />
        <path d={art.lineBars.map(line).join('')} strokeWidth={LINE_W} />
        <path d={art.bars.map(line).join('')} strokeWidth={DASH} />
      </g>
      {[FINDERS.tl, FINDERS.tr].map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={0.2} fill="url(#bytecode-glow)" />
      ))}
      {EYES.map((r, i) => (
        <path key={i} d={r.d} className={styles.c4} />
      ))}
      {Object.entries(DOTS).map(([k, d]) => (
        <g key={k}>
          <circle cx={d.x} cy={d.y} r={R_SMALL + 0.02} className={styles.pale} />
          <circle cx={d.x} cy={d.y} r={R_SMALL} className={styles.ink} />
        </g>
      ))}
    </svg>
  );
}
