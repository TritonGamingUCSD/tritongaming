'use client';

import Image from 'next/image';
import styles from './tracker.module.css';

export function Avatar({ name, src }: { name: string; src: string | null }) {
  return src ? (
    <Image src={src} alt="" width={36} height={36} unoptimized referrerPolicy="no-referrer" className={styles.avatar} />
  ) : (
    <span className={styles.avatarFallback}>{name[0]?.toUpperCase() ?? '?'}</span>
  );
}
