'use client';

import { useState, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import styles from './charts.module.css';

export interface ChartTable {
  head: string[];
  rows: (string | number)[][];
}

// A chart on a paper card: a sticker-style title, a one-line "what to take from this", the chart, and a Table switch (the same numbers as text, for screen readers and for reading exact values).
export default function ChartCard({
  title,
  sub,
  table,
  children,
  wide = false,
  foot,
}: {
  title: string;
  sub?: string;
  table?: ChartTable;
  children: ReactNode;
  wide?: boolean;
  foot?: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`${styles.card} ${wide ? styles.wide : ''}`}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {sub && <p className={styles.sub}>{sub}</p>}
        </div>
        {table && (
          <button type="button" className={styles.switch} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? <BarChart3 size={14} aria-hidden="true" /> : <Table2 size={14} aria-hidden="true" />} {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </header>
      {asTable && table ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {table.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
      {foot && <p className={styles.foot}>{foot}</p>}
    </section>
  );
}
