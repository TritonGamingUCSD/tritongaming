import Image from 'next/image';
import Link from 'next/link';
import type { MyDivision } from './getMyDivisionsData';
import IconButton from '@/components/ui/IconButton';
import styles from './divisions.module.css';

function logoSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`;
}

// The lighter counterpart to DivisionsManager.tsx — the division(s) *this*
// person leads (matching the manage_division RLS scoping), each just
// linking out to the same dedicated edit page DivisionsManager's own "Edit"
// links use (see divisions/[id]/ — it does its own capability check, so a
// division lead editing their own page and an exec/admin editing any page
// share the exact same form). No name/slug shown as editable here — renaming
// or re-slugging changes the division's public URL, a directory-level
// decision the edit page itself reserves for exec/admin.
export default function MyDivisionsEditor({ divisions }: { divisions: MyDivision[] }) {
  if (divisions.length === 0) {
    return <div className={styles.empty}>You&apos;re not currently leading a division.</div>;
  }

  return (
    <div className={styles.list}>
      {divisions.map((d) => {
        const src = logoSrc(d.logo_url);
        return (
          <div key={d.id} className={styles.listRow}>
            {src ? (
              <Image src={src} alt="" width={40} height={40} className={styles.logo} unoptimized />
            ) : (
              <div className={styles.logoFallback}>{d.name[0]}</div>
            )}
            <div className={styles.listRowText}>
              <div className={styles.name}>{d.name}</div>
              <Link href={`/divisions/${d.slug}`} target="_blank" className={styles.slug}>/divisions/{d.slug} ↗</Link>
            </div>
            <div className={styles.actions}>
              <IconButton kind="edit" href={`/portal/divisions/${d.id}`} label={`Edit ${d.name}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
