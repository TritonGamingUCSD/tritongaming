import { useEffect, useId, useState } from 'react';
import { REGIONS, EYES, STROKES, DOTS_OF_INK, EYE_SHAPES } from '@/lib/qr/byteCode/byteArt';
import styles from './ByteWink.module.css';

// The short wink of Byte after a good scan (the scanner's success and the scanned screen's): the mascot drawn as he is, popping up with a hop while both his eyes blink shut and open again
// as happy ^ eyes, sparkles burst round his head and a check mark pops out. It plays once when it appears and stays as it ends; remount it (a new `key`) to play again.
// Built for smoothness on a phone: his body is one drawing that is painted once and then only moved as a whole; each eye, each sparkle and the badge is its own small layer that
// only changes its size and opacity, so no frame ever repaints the big drawing.
const line = (pts: [number, number][]) => `M${pts.map((p) => p.join(' ')).join('L')}`;
const SPARKS: [number, number, number][] = [
  [-0.62, -0.78, 0.1],
  [0.66, -0.72, 0.12],
  [-0.85, -0.3, 0.07],
  [0.88, -0.28, 0.08],
];
const star = (r: number) => `M0 ${-r}L${r * 0.28} ${-r * 0.28}L${r} 0L${r * 0.28} ${r * 0.28}L0 ${r}L${-r * 0.28} ${r * 0.28}L${-r} 0L${-r * 0.28} ${-r * 0.28}Z`;
const pct = (v: number) => `${(((v + 1) / 2) * 100).toFixed(3)}%`;
/** A small layer centred on (x, y) in code units, `half` units to each side. */
const spot = (x: number, y: number, half: number): React.CSSProperties => ({ left: pct(x - half), top: pct(y - half), width: `${half * 100}%`, height: `${half * 100}%` });

// The wink's timing: the eyes swap to their drawn copies at SWAP and bend into ^ over BEND (the same moment as the CSS in ByteWink.module.css).
const SWAP = '0.34s';
const BEND = '0.26s';
const SPLINE = { calcMode: 'spline', keySplines: '0.4 0 0.2 1', keyTimes: '0;1', fill: 'freeze', begin: SWAP, dur: BEND } as const;
// Every path here has the same two curved pieces (M, Q, Q), so the browser can bend one into another. The happy eye is a smooth dome; the I starts as that dome stretched straight up and
// down, and the X's lower arms start as two straight pieces meeting at its middle.
const DOME = (x: number, y: number) => `M${x - 0.095} ${y + 0.03}Q${x - 0.04} ${y - 0.045} ${x} ${y - 0.045}Q${x + 0.04} ${y - 0.045} ${x + 0.095} ${y + 0.03}`;
const pieces = (a: [number, number], b: [number, number], c: [number, number]) =>
  `M${a[0]} ${a[1]}Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}Q${(b[0] + c[0]) / 2} ${(b[1] + c[1]) / 2} ${c[0]} ${c[1]}`;

function MorphI({ x, y, still }: { x: number; y: number; still: boolean }) {
  return (
    <path d={still ? DOME(x, y) : pieces([x, y - 0.099], [x, y], [x, y + 0.099])} className={styles.arc} strokeWidth={still ? 0.05 : 0.04}>
      {!still && (
        <>
          <animate attributeName="d" to={DOME(x, y)} {...SPLINE} />
          <animate attributeName="stroke-width" to="0.05" {...SPLINE} />
        </>
      )}
    </path>
  );
}

function MorphX({ x, y, still }: { x: number; y: number; still: boolean }) {
  const k = 0.0824;
  return (
    <>
      {!still && (
        <path d={pieces([x - k, y - k], [x, y], [x + k, y - k])} className={styles.arc} strokeWidth={0.035}>
          <animate attributeName="d" to={pieces([x, y], [x, y], [x, y])} {...SPLINE} />
          <animate attributeName="opacity" to="0" {...SPLINE} />
        </path>
      )}
      <path d={still ? DOME(x, y) : pieces([x - k, y + k], [x, y], [x + k, y + k])} className={styles.arc} strokeWidth={still ? 0.05 : 0.035}>
        {!still && (
          <>
            <animate attributeName="d" to={DOME(x, y)} {...SPLINE} />
            <animate attributeName="stroke-width" to="0.05" {...SPLINE} />
          </>
        )}
      </path>
    </>
  );
}

export default function ByteWink({
  size,
  className = '',
  label = 'Byte winks: scanned',
  entrance = true,
}: {
  size?: number;
  className?: string;
  label?: string;
  entrance?: boolean;
}) {
  const glow = `bw${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [calm, setCalm] = useState(false); // reduced motion: the eyes just show as they end
  useEffect(() => setCalm(window.matchMedia('(prefers-reduced-motion: reduce)').matches), []);
  const eyes = [EYE_SHAPES.pill, EYE_SHAPES.x];
  return (
    <div className={`${styles.wink} ${className}`} style={size ? { width: size, height: size } : undefined} role="img" aria-label={label}>
      <div className={entrance ? styles.pop : styles.hop}>
        <svg viewBox="-1 -1 2 2" className={styles.layer} aria-hidden="true">
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
          <g className={styles.line} strokeWidth={0.026}>
            {STROKES.filter((s) => !s.halo).map((s, i) => (
              <path key={i} d={line(s.pts)} />
            ))}
          </g>
          {eyes.map((e, i) => (
            <circle key={i} cx={e.x} cy={e.y} r={0.2} fill={`url(#${glow})`} />
          ))}
        </svg>
        {/* His eyes as he has them (the pale I and the pale X) until the wink begins; then each is swapped for a drawn copy of itself that bends into a happy ^: the I bends over into it, and the X
            lets go of its upper arms while its lower two close into it (the lower arms of an X already are a ^). */}
        {EYES.map((e, i) => (
          <svg key={`e${i}`} viewBox="-1 -1 2 2" className={`${styles.layer} ${styles.eyeOut}`} aria-hidden="true">
            <path d={e.d} className={styles.c4} />
          </svg>
        ))}
        <svg viewBox="-1 -1 2 2" className={`${styles.layer} ${styles.morph}`} aria-hidden="true">
          <MorphI x={EYE_SHAPES.pill.x} y={EYE_SHAPES.pill.y} still={calm} />
          <MorphX x={EYE_SHAPES.x.x} y={EYE_SHAPES.x.y} still={calm} />
        </svg>
      </div>
      {SPARKS.map(([x, y, r], i) => (
        <svg
          key={`s${i}`}
          viewBox={`${-r * 1.3} ${-r * 1.3} ${r * 2.6} ${r * 2.6}`}
          className={`${styles.small} ${styles[`s${i + 1}` as 's1']}`}
          style={spot(x, y, r * 1.3)}
          aria-hidden="true"
        >
          <path d={star(r)} className={styles.spark} />
        </svg>
      ))}
      <svg viewBox="-1 -1 2 2" className={`${styles.small} ${styles.badgeG}`} style={spot(0.72, -0.78, 0.22)} aria-hidden="true">
        <circle r="0.9" className={styles.badge} />
        <path d="M-0.45 0.02L-0.12 0.36L0.5 -0.4" className={styles.tick} />
      </svg>
    </div>
  );
}
