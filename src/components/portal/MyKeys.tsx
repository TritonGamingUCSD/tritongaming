'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import styles from './MyKeys.module.css';

interface Key { id: string; name: string; color: string; mine: boolean }

// "You have these storage keys", on your own profile. Shows nothing unless you're on the key team and hold a key.
export default function MyKeys() {
  const [keys, setKeys] = useState<Key[]>([]);
  useEffect(() => {
    let live = true;
    fetch('/api/keys', { cache: 'no-store' }).then(async (r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setKeys((j.keys as Key[]).filter((k) => k.mine)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (keys.length === 0) return null;
  return (
    <section className={styles.wrap} aria-label="Your storage keys">
      <span className={styles.label}>{keys.length === 1 ? 'You have a storage key' : `You have ${keys.length} storage keys`}</span>
      <span className={styles.pills}>
        {keys.map((k) => <span key={k.id} className={styles.pill} style={{ background: k.color }}><KeyRound size={14} strokeWidth={2.5} aria-hidden="true" /> {k.name}</span>)}
      </span>
      <Link href="/portal?section=keys" className={styles.link}>Open Storage Keys →</Link>
    </section>
  );
}
