import styles from './homeHero.module.css';

export interface TermInfo {
  name: string;
  week: number;
  weeks: number;
  /** Days left in the term (0 after it ends). */
  daysLeft: number;
  starts: string;
  ends: string;
  /** Where the term is now: 'in' it, 'break' after it ended and before the next one. */
  state: 'in' | 'break';
  marks: { label: string; at: string }[];
}

// How far through the quarter we are: one pixel block for each week, filled up to this week, with the term's dates and the next few events under it.
export default function TermProgress({ term }: { term: TermInfo }) {
  return (
    <section className={styles.term} aria-label="This quarter">
      <div className={styles.termHead}>
        <h2 className={styles.termTitle}>{term.name}</h2>
        <span className={styles.termStatus}>{term.state === 'in' ? `Week ${term.week} of ${term.weeks}` : 'Break'}</span>
      </div>
      <div className={styles.blocks} role="img" aria-label={`Week ${term.week} of ${term.weeks}`}>
        {Array.from({ length: term.weeks }, (_, i) => (
          <span key={i} className={`${styles.block} ${i < term.week ? styles.done : ''} ${i === term.week - 1 && term.state === 'in' ? styles.now : ''}`} />
        ))}
      </div>
      <p className={styles.termDates}>
        <span>{term.starts}</span>
        <span>{term.state === 'in' ? `${term.daysLeft} days left` : 'Next term soon'}</span>
        <span>{term.ends}</span>
      </p>
      {term.marks.length > 0 && (
        <ul className={styles.marks}>
          {term.marks.map((m) => (
            <li key={m.label + m.at}>
              <span>{m.at}</span> {m.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
