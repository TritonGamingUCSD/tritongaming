'use client';

import { Lock } from 'lucide-react';
import styles from './tracker.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

export function Header() {
  return (
    <SectionHeader
      title="Strikes"
      flush
      foldOnPhone="How strikes work"
      sub={
        <>
          <Lock size={13} aria-hidden="true" className={styles.lockIcon} /> Private to the person, exec and HR. The first mark is a warning; 3 strikes after it is the limit. Every
          action has a reason the person can read, never who did it.
        </>
      }
    />
  );
}
