import styles from './AlternateTitle.module.css';

interface AlternateTitleProps {
  fgTitle: string;
  bgTitle: string;
}

export default function AlternateTitle({ fgTitle, bgTitle }: AlternateTitleProps) {
  return (
    <div className={styles.root}>
      <h2 className={styles.bg} aria-hidden="true">{bgTitle}</h2>
      <h2 className={styles.fg}>{fgTitle}</h2>
    </div>
  );
}
