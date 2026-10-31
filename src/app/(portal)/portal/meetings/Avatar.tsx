'use client';

import Image from 'next/image';
import { resolveAvatarUrl } from '@/lib/members/profile';
import styles from './meetings.module.css';
import { Person } from './types';

export function Avatar({ p }: { p: Person }) {
  const src = resolveAvatarUrl(p);
  return src ? (
    <Image src={src} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" className={styles.avatar} />
  ) : (
    <span className={styles.avatarFallback}>{p.name[0]?.toUpperCase() ?? '?'}</span>
  );
}
