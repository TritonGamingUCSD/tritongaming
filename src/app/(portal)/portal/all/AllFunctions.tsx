'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import SectionHeader from '@/components/ui/SectionHeader';
import styles from './all.module.css';

export interface FunctionItem {
  id: string;
  label: string;
  description: string;
}

// Every page this person can open, A to Z, with a filter. The sidebar groups pages by area; this is for when you know the name.
export default function AllFunctions({ items }: { items: FunctionItem[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = items
    .filter((i) => !needle || i.label.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle))
    .sort((a, b) => a.label.localeCompare(b.label));
  const letters = [...new Set(shown.map((i) => i.label[0].toUpperCase()))];
  return (
    <div className={styles.page}>
      <SectionHeader title="All Functions" flush sub="Every page you can open, A to Z." />
      <label className={styles.filter}>
        <Search size={15} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name" aria-label="Filter pages" />
      </label>
      {shown.length === 0 && <p className={styles.none}>No page matches “{q}”.</p>}
      {letters.map((l) => (
        <section key={l} className={styles.letter} aria-label={l}>
          <h2 className={styles.mark}>{l}</h2>
          <ul className={styles.list}>
            {shown
              .filter((i) => i.label[0].toUpperCase() === l)
              .map((i) => (
                <li key={i.id}>
                  <Link href={`/portal/${i.id}`} className={styles.row}>
                    <strong>{i.label}</strong>
                    <span>{i.description}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
