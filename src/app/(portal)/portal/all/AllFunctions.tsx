'use client';

import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import Link from '@/components/portal/PortalLink';
import SectionHeader from '@/components/ui/SectionHeader';
import styles from './all.module.css';

export interface FunctionItem {
  id: string;
  label: string;
  description: string;
}

// Every page this person can open, A to Z, with a filter. The sidebar groups pages by area; this is for when you know the name.
export default function AllFunctions({ items, pinned = [] }: { items: FunctionItem[]; pinned?: string[] }) {
  const [q, setQ] = useState('');
  const [pins, setPins] = useState<Set<string>>(new Set(pinned));
  // The star saves on the server, so the pinned pages show on Home and follow the person to other devices.
  async function toggle(id: string) {
    const on = !pins.has(id);
    setPins((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
    const res = await fetch('/api/portal/pins', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section_id: id, pinned: on }) }).catch(
      () => null,
    );
    if (!res?.ok)
      setPins((p) => {
        const n = new Set(p);
        if (on) n.delete(id);
        else n.add(id);
        return n;
      });
  }
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
                <li key={i.id} className={styles.item}>
                  <Link href={`/portal/${i.id}`} className={styles.row}>
                    <strong>{i.label}</strong>
                    <span>{i.description}</span>
                  </Link>
                  <button
                    type="button"
                    className={`${styles.star} ${pins.has(i.id) ? styles.starOn : ''}`}
                    onClick={() => toggle(i.id)}
                    aria-pressed={pins.has(i.id)}
                    aria-label={`${pins.has(i.id) ? 'Unpin' : 'Pin'} ${i.label}`}
                  >
                    <Star size={16} aria-hidden="true" fill={pins.has(i.id) ? 'currentColor' : 'none'} />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
