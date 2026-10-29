import { Check } from 'lucide-react';
import styles from './ProgressSteps.module.css';

// What is happening after one tap, when a few things run in a row: a ring that fills as the steps finish, a headline for the step in progress, and the whole
// list below with a line that fills down it. `active` is the index of the step in progress; a number past the end means everything is done.
const R = 44;
const CIRC = 2 * Math.PI * R;

export default function ProgressSteps({
  steps,
  active,
  title,
  doneTitle = 'All done',
  subtitle,
}: {
  steps: string[];
  active: number;
  title?: string;
  doneTitle?: string;
  subtitle?: string;
}) {
  const done = active >= steps.length;
  // The step being worked on counts as half done, so the ring is always visibly moving.
  const fraction = done ? 1 : Math.min(1, (active + 0.5) / steps.length);
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={`${styles.ringWrap} ${done ? styles.ringDone : ''}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" className={`${styles.ring} ${done ? '' : styles.ringTurning}`}>
          <circle cx="50" cy="50" r={R} className={styles.track} />
          <circle cx="50" cy="50" r={R} className={styles.arc} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - fraction)} transform="rotate(-90 50 50)" />
        </svg>
        <span className={styles.center}>
          {done ? (
            <Check size={38} strokeWidth={3.2} className={styles.bigCheck} />
          ) : (
            <span className={styles.count}>
              {active + 1}
              <small>/{steps.length}</small>
            </span>
          )}
        </span>
      </div>

      <div className={styles.head}>
        <p className={styles.title}>
          {done ? doneTitle : steps[active]}
          {!done && (
            <span className={styles.dots} aria-hidden="true">
              <i>.</i>
              <i>.</i>
              <i>.</i>
            </span>
          )}
        </p>
        {(subtitle || title) && <p className={styles.sub}>{done ? subtitle : title}</p>}
      </div>

      <ol className={styles.list}>
        {steps.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'now' : 'later';
          return (
            <li key={label} className={`${styles.item} ${styles[state]}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className={styles.mark} aria-hidden="true">
                {state === 'done' ? <Check size={14} strokeWidth={3.4} /> : i + 1}
              </span>
              <span className={styles.label}>{label}</span>
              <span className={styles.state}>{state === 'done' ? 'Done' : state === 'now' ? 'Working' : 'Next'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
