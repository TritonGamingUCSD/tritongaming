import type { CSSProperties } from 'react';
import styles from './logistics.module.css';

// The one definition of a list that is a table on a laptop and a stack of cards on a phone. A table is a list of columns (a label and a width, a minimum and a fraction so spare room is
// shared evenly); the header and every row take the same widths from `--cols`, so columns line up row to row. On a phone the columns are ignored: each row becomes a card and every
// cell shows its `data-label` above it (see the phone block in the stylesheet).
export interface Col { label: string; width: string }

// `--w` is how wide the table needs to be (each column's minimum, plus the gaps and padding): on a phone the table keeps that width and scrolls sideways, one line per row.
const minRem = (w: string) => Number((/(\d+(?:\.\d+)?)rem/.exec(w) ?? [])[1] ?? 6);
export const gridStyle = (cols: Col[]): CSSProperties => ({ '--cols': cols.map((c) => c.width).join(' '), '--w': `${Math.round(cols.reduce((n, c) => n + minRem(c.width), 0) + cols.length * 0.9 + 2)}rem` } as CSSProperties);

export function GridHead({ cols }: { cols: Col[] }) {
  return <div className={`${styles.prizeRow} ${styles.prizeHeadRow}`} style={gridStyle(cols)} aria-hidden="true">{cols.map((c, i) => <span key={i}>{c.label}</span>)}</div>;
}

const col = (label: string, width: string): Col => ({ label, width });
const TOOLS = col('', '5rem');

export const EQUIPMENT_COLS: Col[] = [col('ID', '8rem'), col('Name', 'minmax(12rem, 1.8fr)'), col('Type', 'minmax(9rem, 1fr)'), col('Shelf', 'minmax(8rem, 1fr)'), col('Tier', '6rem'), col('Condition', '9rem'), col('Kit', '7rem'), TOOLS];
export const borrowedCols = (sponsor: boolean): Col[] => [col('ID', '8.5rem'), col('Type', 'minmax(10rem, 1.2fr)'), col(sponsor ? 'Sponsor' : 'Officer', 'minmax(10rem, 1.3fr)'), col('Station', 'minmax(8rem, 1fr)'),
  col('Installed games', 'minmax(12rem, 1.8fr)'), col('Status', 'minmax(8rem, 1fr)'), col('', '9rem')];
export const SPONSOR_COLS: Col[] = [col('Sponsor', 'minmax(11rem, 1.2fr)'), col('Contact', 'minmax(11rem, 1.4fr)'), col('Notes', 'minmax(13rem, 2.5fr)'), TOOLS];
export const REQUEST_COLS: Col[] = [col('Contact', 'minmax(12rem, 1.4fr)'), col('For', 'minmax(9rem, 1fr)'), col('What', 'minmax(13rem, 2fr)'), col('Notes', 'minmax(10rem, 1.4fr)'), col('Status', '8rem'), col('', 'minmax(5rem, 1fr)')];
