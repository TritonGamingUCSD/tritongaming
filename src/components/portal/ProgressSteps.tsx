import { Check, Loader2 } from 'lucide-react';
import styles from './ProgressSteps.module.css';

// A short list of what is happening, one line per step: done (check), now (spinner), later (dot). Used where a few things happen in a row after one tap, so the
// person can see it is working and what comes next. `active` is the index of the step in progress; a number past the end means everything is done.
export default function ProgressSteps({ steps, active, title }: { steps: string[]; active: number; title?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      {title && <p className={styles.title}>{title}</p>}
      <ol className={styles.list}>
        {steps.map((label, i) => {
          const state = i < active ? 'done' : i === active ? 'now' : 'later';
          return (
            <li key={label} className={`${styles.item} ${styles[state]}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className={styles.mark} aria-hidden="true">
                {state === 'done' ? <Check size={15} strokeWidth={3} /> : state === 'now' ? <Loader2 size={16} className={styles.spin} /> : <span className={styles.dot} />}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
