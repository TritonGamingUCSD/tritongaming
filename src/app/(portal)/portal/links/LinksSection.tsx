import LinksManager from './LinksManager';
import styles from '../content/sitecontent.module.css';

// Short links (tritongaming.org/linktree → any URL). Admin only — see the
// 'links' section in portal/page.tsx and the gate in /api/admin/links.
export default function LinksSection() {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Short Links</h1>
          <p className={styles.titleSub}>Custom redirects on your own domain — e.g. /linktree</p>
        </div>
      </div>
      <LinksManager />
    </div>
  );
}
