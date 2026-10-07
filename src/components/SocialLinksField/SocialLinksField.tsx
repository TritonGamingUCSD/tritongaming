'use client';

import Image from 'next/image';
import { SOCIAL_PLATFORMS } from '@/lib/members/profile';
import styles from './SocialLinksField.module.css';

// Same {platformKey: handle} editor already used for a member's own profile
// (see ProfileClient.tsx) — extracted here so division pages can reuse it
// unchanged rather than re-inventing the same grid of icon+handle inputs.
export default function SocialLinksField({
  value,
  onChange,
  label = 'Social Links',
  hint = "Just your handle, not the full link — optional.",
  exclude = [],
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  label?: string;
  hint?: string;
  /** Platform keys to leave out — e.g. 'discord' when the caller already has
   * its own dedicated Discord field/CTA elsewhere. */
  exclude?: string[];
}) {
  const platforms = SOCIAL_PLATFORMS.filter((p) => !exclude.includes(p.key));

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.grid}>
        {platforms.map((p) => (
          <label key={p.key} className={styles.socialField}>
            <Image src={p.logo} alt="" width={18} height={18} unoptimized className={styles.icon} />
            <input
              className={styles.input}
              value={value[p.key] ?? ''}
              onChange={(e) => onChange({ ...value, [p.key]: e.target.value })}
              placeholder={p.placeholder}
              aria-label={p.label}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
