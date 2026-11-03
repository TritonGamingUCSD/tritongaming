import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import styles from './DetailHeader.module.css';

// The top of a page inside a section (one poll, one issue, one quiz, one Q&A): a way back to the list above the title, the title with its state beside it, and the page's actions on the right (below the title on a phone, full width,
// the main one first). Every such page uses it, so the way back, the title and the actions are always in the same place. The list pages use SectionHeader the same way.
export default function DetailHeader({
  back,
  title,
  chip,
  sub,
  note,
  actions,
}: {
  back: { label: string; onClick: () => void };
  /** The page's title (text, or something editable such as a rename field). */
  title: ReactNode;
  /** Where it stands (Draft, Open, Sent…), shown beside the title. */
  chip?: ReactNode;
  /** One quiet line under the title (counts, dates). */
  sub?: ReactNode;
  /** A small quiet line beside the actions (such as "Saved"). */
  note?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.header} data-detail-header>
      <button type="button" className={styles.back} onClick={back.onClick}>
        <ArrowLeft size={15} aria-hidden="true" /> {back.label}
      </button>
      <div className={styles.row}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>{title}</h1>
          {chip && <span className={styles.chip}>{chip}</span>}
          {sub && <p className={styles.sub}>{sub}</p>}
        </div>
        {(actions || note) && (
          <div className={styles.actions}>
            {note && (
              <span className={styles.note} role="status">
                {note}
              </span>
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
