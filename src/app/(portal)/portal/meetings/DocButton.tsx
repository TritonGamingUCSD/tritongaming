'use client';

import { ExternalLink, FileText } from 'lucide-react';
import styles from './meetings.module.css';

// A doc link is either a full URL (new tab) or a path inside the site (same tab).
export function DocButton({ url, label = 'Open meeting doc' }: { url: string; label?: string }) {
  const external = /^https?:/i.test(url);
  return (
    <a className={styles.docBtn} href={url} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      <FileText size={16} aria-hidden="true" /> {label} {external && <ExternalLink size={13} aria-hidden="true" />}
    </a>
  );
}
