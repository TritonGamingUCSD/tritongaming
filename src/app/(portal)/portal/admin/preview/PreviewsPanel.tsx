'use client';

import Link from 'next/link';
import { PREVIEWS } from './catalog';
import CodeStyleSwitch from './CodeStyleSwitch';
import styles from './preview.module.css';

// Admin › System › Previews: a list of every screen and animation that can be previewed, each with a page of its own (/portal/admin/preview/<slug>). Only Admins see this tab.
export default function PreviewsPanel() {
  const groups = [...new Set(PREVIEWS.map((p) => p.group))];
  return (
    <div className={styles.page}>
      <p className={styles.note}>Every screen and animation that can be played here, with sample data. Nothing is saved and nobody is notified.</p>
      <CodeStyleSwitch />
      {groups.map((g) => (
        <section key={g} className={styles.group}>
          <h2>{g}</h2>
          <ul className={styles.list}>
            {PREVIEWS.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <Link href={`/portal/admin/preview/${p.slug}`} className={styles.item}>
                  <strong>{p.title}</strong>
                  <span>{p.about}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
