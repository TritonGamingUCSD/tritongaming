import { useId } from 'react';
import { REGIONS, EYES, STROKES, DOTS_OF_INK, EYE_SHAPES } from '@/lib/qr/byteCode/byteArt';
import styles from './ByteWink.module.css';

// The short wink of Byte after a good scan (the scanner's success and the scanned screen's): the mascot drawn as he is, popping up with a hop while both his eyes blink shut and open again as happy ^ eyes,
// sparkles burst round his head and a check mark pops out. It plays once when it appears and stays as it ends; remount it (a new `key`) to play again.
const line = (pts: [number, number][]) => `M${pts.map((p) => p.join(' ')).join('L')}`;
const SPARKS: [number, number, number][] = [
  [-0.62, -0.78, 0.1],
  [0.66, -0.72, 0.12],
  [-0.85, -0.3, 0.07],
  [0.88, -0.28, 0.08],
];
const star = (x: number, y: number, r: number) =>
  `M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`;

export default function ByteWink({ size, className = '', label = 'Byte winks: scanned' }: { size?: number; className?: string; label?: string }) {
  const glow = `bw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} className={`${styles.wink} ${className}`} role="img" aria-label={label}>
      <defs>
        <radialGradient id={glow}>
          <stop offset="0.45" className={styles.glowA} />
          <stop offset="1" className={styles.glowB} />
        </radialGradient>
      </defs>
      <g className={styles.pop}>
        {REGIONS.map((r, i) => (
          <path key={i} d={r.d} className={styles[`c${r.col}` as 'c2']} />
        ))}
        {DOTS_OF_INK.map((r, i) => (
          <path key={i} d={r.d} className={styles.ink} />
        ))}
        <g className={styles.line} strokeWidth={0.026}>
          {STROKES.filter((s) => !s.halo).map((s, i) => (
            <path key={i} d={line(s.pts)} />
          ))}
        </g>
        <circle cx={EYE_SHAPES.pill.x} cy={EYE_SHAPES.pill.y} r={0.2} fill={`url(#${glow})`} />
        <circle cx={EYE_SHAPES.x.x} cy={EYE_SHAPES.x.y} r={0.2} fill={`url(#${glow})`} />
        {/* both eyes: the green of his head under them stays, the pale pill and the pale X vanish and a happy ^ takes the place of each */}
        {EYES.map((e, i) => (
          <path key={`g${i}`} d={e.d} className={styles.c3} />
        ))}
        {EYES.map((e, i) => (
          <path key={`e${i}`} d={e.d} className={`${styles.c4} ${styles.eyeOut}`} />
        ))}
        {[EYE_SHAPES.pill, EYE_SHAPES.x].map((e, i) => (
          <path key={`h${i}`} d={`M${e.x - 0.085} ${e.y + 0.035}Q${e.x} ${e.y - 0.085} ${e.x + 0.085} ${e.y + 0.035}`} className={styles.happy} />
        ))}
      </g>
      {SPARKS.map(([sx, sy, sr], i) => (
        <path key={i} d={star(sx, sy, sr)} className={`${styles.spark} ${styles[`s${i + 1}` as 's1']}`} />
      ))}
      <g className={styles.badgeG}>
        <circle cx="0.72" cy="-0.78" r="0.2" className={styles.badge} />
        <path d="M0.62 -0.78L0.7 -0.7L0.84 -0.86" className={styles.tick} />
      </g>
    </svg>
  );
}
