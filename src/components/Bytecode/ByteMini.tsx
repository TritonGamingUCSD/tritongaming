import { MINI_FILLS, MINI_INNER, MINI_OUTER } from './miniArt';
import styles from './ByteMini.module.css';

// A small Byte for places that must stay light (the loading screens, empty lists, the 404): the mascot simplified (miniArt.ts, a few KB where the Bytecode's drawing is over 150) in one of
// a few poses. He sits on whatever he is on; his outer line follows the theme like the Bytecode's (plum on a light card, cream on a dark one).
//   awake   his own eyes (the pale I and X), blinking now and then
//   sleep   eyes shut, a few z's drifting up
//   lost    a question mark wobbling beside his head
//   happy   the happy ^ eyes of the wink
export type MiniPose = 'awake' | 'sleep' | 'lost' | 'happy';

// His eyes, where the code has them (EYE_SHAPES in byteArt.ts).
const PILL = { x: -0.277, y: -0.258 };
const CROSS = { x: 0.079, y: -0.268 };
const shut = (x: number, y: number) => `M${x - 0.1} ${y - 0.03}Q${x} ${y + 0.07} ${x + 0.1} ${y - 0.03}`;
const happy = (x: number, y: number) => `M${x - 0.095} ${y + 0.03}Q${x - 0.04} ${y - 0.045} ${x} ${y - 0.045}Q${x + 0.04} ${y - 0.045} ${x + 0.095} ${y + 0.03}`;
const Z = 'M-0.07 -0.07H0.07L-0.07 0.07H0.07';
const QUESTION = 'M-0.08 -0.1Q-0.08 -0.2 0 -0.2Q0.1 -0.2 0.1 -0.11Q0.1 -0.05 0.03 -0.01Q0.01 0.01 0.01 0.06';

export default function ByteMini({ pose = 'awake', size, className = '' }: { pose?: MiniPose; size?: number; className?: string }) {
  return (
    <svg viewBox="-1.1 -1.1 2.2 2.2" width={size} height={size} className={`${styles.mini} ${className}`} aria-hidden="true">
      <g className={pose === 'lost' ? styles.tilt : undefined}>
        {MINI_FILLS.map(([col, d]) => (
          <path key={col} d={d} className={styles[`c${col}` as 'c2']} />
        ))}
        <path d={MINI_INNER} className={styles.line} strokeWidth={0.026} />
        <path d={MINI_OUTER} className={`${styles.line} ${styles.edge}`} strokeWidth={0.034} />
        {pose === 'awake' || pose === 'lost' ? (
          <g className={styles.blink}>
            <path d={`M${PILL.x} ${PILL.y - 0.1}V${PILL.y + 0.1}`} className={styles.eyeRim} strokeWidth={0.11} />
            <path
              d={`M${CROSS.x - 0.08} ${CROSS.y - 0.08}L${CROSS.x + 0.08} ${CROSS.y + 0.08}M${CROSS.x + 0.08} ${CROSS.y - 0.08}L${CROSS.x - 0.08} ${CROSS.y + 0.08}`}
              className={styles.eyeRim}
              strokeWidth={0.1}
            />
            <path d={`M${PILL.x} ${PILL.y - 0.1}V${PILL.y + 0.1}`} className={styles.eye} strokeWidth={0.06} />
            <path
              d={`M${CROSS.x - 0.08} ${CROSS.y - 0.08}L${CROSS.x + 0.08} ${CROSS.y + 0.08}M${CROSS.x + 0.08} ${CROSS.y - 0.08}L${CROSS.x - 0.08} ${CROSS.y + 0.08}`}
              className={styles.eye}
              strokeWidth={0.05}
            />
          </g>
        ) : (
          <>
            <path d={pose === 'sleep' ? shut(PILL.x, PILL.y) : happy(PILL.x, PILL.y)} className={styles.arc} strokeWidth={0.05} />
            <path d={pose === 'sleep' ? shut(CROSS.x, CROSS.y) : happy(CROSS.x, CROSS.y)} className={styles.arc} strokeWidth={0.05} />
          </>
        )}
      </g>
      {pose === 'sleep' &&
        [0, 1, 2].map((i) => (
          <path key={i} d={Z} className={`${styles.z} ${styles.edge}`} style={{ animationDelay: `${i * 0.9}s`, transform: `translate(${0.6 + i * 0.12}px, ${-0.7}px)` }} />
        ))}
      {pose === 'lost' && (
        <g transform="translate(0.78 -0.55) scale(1.5)">
          <g className={styles.question}>
            <path d={QUESTION} className={`${styles.line} ${styles.edge}`} strokeWidth={0.05} fill="none" />
            <circle cx="0.01" cy="0.13" r="0.035" className={styles.dot} />
          </g>
        </g>
      )}
    </svg>
  );
}
