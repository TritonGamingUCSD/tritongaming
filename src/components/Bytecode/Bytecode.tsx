import { useId } from 'react';
import { drawing, PAYLOAD, LINE_W, INNER_W, PATCH_H, FINDERS } from '@/lib/qr/byteCode/layout';
import { REGIONS, EYES, DOTS_OF_INK } from '@/lib/qr/byteCode/byteArt';
import styles from './Bytecode.module.css';

// The portal's cute code: the TGcode's message (see lib/qr/byteCode) written into Byte, the Triton Gaming mascot, drawn as he is. Parts of his own line work (and bars across his
// flat areas) are broken into dashes that carry the message; his own eyes (the pill and the X) are the two marks that say where the code is and which way up, and his scarf and gem straighten a tilted one. Only the portal's Scan button reads it.
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
  const glow = `bc${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!PAYLOAD.test(payload)) return null;
  const art = drawing(payload);
  if (!art) return null;
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} className={`${styles.code} ${className}`} role="img" aria-label={label}>
      <defs>
        <radialGradient id={`${glow}s`}>
          <stop offset="0" className={styles.shadowA} />
          <stop offset="1" className={styles.shadowB} />
        </radialGradient>
        <radialGradient id={glow}>
          <stop offset="0.45" className={styles.glowA} />
          <stop offset="1" className={styles.glowB} />
        </radialGradient>
      </defs>
      {/* a soft shadow on the ground between his feet (his own drawing's grey shadow is left out: it stuck out past the sticker's border) */}
      <ellipse cx="0" cy="0.835" rx="0.36" ry="0.05" fill={`url(#${glow}s)`} />
      {REGIONS.map((r, i) => (
        <path key={i} d={r.d} className={styles[`c${r.col}` as 'c2']} />
      ))}
      {DOTS_OF_INK.map((r, i) => (
        <path key={i} d={r.d} className={styles.ink} />
      ))}
      {/* the message's shade patches: pairs of small squares on his flat colours, one a little lighter and one a little darker (which is which is a bit) */}
      <g>
        {art.patches.map((p, i) => (
          <rect
            key={i}
            x={p.x - PATCH_H}
            y={p.y - PATCH_H}
            width={PATCH_H * 2}
            height={PATCH_H * 2}
            rx={PATCH_H * 0.35}
            className={p.light ? styles.patchLight : styles.patchDark}
          />
        ))}
      </g>
      <g className={styles.line} strokeWidth={INNER_W}>
        <path d={art.inner.map(line).join('')} />
      </g>
      <g className={`${styles.line} ${styles.edge}`} strokeWidth={LINE_W}>
        <path d={art.edge.map(line).join('')} />
        <path d={art.lineBars.map(line).join('')} />
      </g>
      {[FINDERS.tl, FINDERS.tr].map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={0.2} fill={`url(#${glow})`} />
      ))}
      {EYES.map((r, i) => (
        <path key={i} d={r.d} className={styles.c4} />
      ))}
    </svg>
  );
}
