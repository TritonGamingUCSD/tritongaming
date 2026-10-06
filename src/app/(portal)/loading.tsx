import styles from './loading.module.css';

// Placed at the outer (portal) route group, not the inner portal/ one — portal/layout.tsx itself does an
// `await getProfile()` auth check before rendering anything, and a loading.tsx only creates a Suspense boundary
// around what's *below* the segment it lives in. One level up here means this covers that auth check too.
// It draws the portal's own shape (sidebar, top bar, cards) so the real page replaces it without a different-looking flash.
export default function PortalLoading() {
  return (
    <div className={styles.frame} role="status" aria-label="Loading your portal">
      <aside className={styles.rail} aria-hidden="true">
        <div className={styles.chromeBone} style={{ height: 36, width: '70%' }} />
        {Array.from({ length: 9 }, (_, i) => <div key={i} className={styles.chromeBone} style={{ height: 28 }} />)}
      </aside>
      <div className={styles.main}>
        <div className={styles.top} aria-hidden="true">
          <div className={styles.chromeBone} style={{ height: 18, width: 160 }} />
          <div className={styles.chromeBone} style={{ height: 32, width: 200, marginLeft: 'auto', borderRadius: 999 }} />
        </div>
        <div className={styles.body} aria-hidden="true">
          <div className={styles.bone} style={{ height: 12, width: 120 }} />
          <div className={styles.bone} style={{ height: 38, width: 'min(420px, 80%)' }} />
          <div className={styles.ticket}>
            <div className={styles.bone} style={{ height: 14, width: 90 }} />
            <div className={styles.bone} style={{ height: 24, width: '55%' }} />
            <div className={styles.bone} style={{ height: 14, width: '35%' }} />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className={styles.card}><div className={styles.bone} style={{ height: 12, width: 70 }} /><div className={styles.bone} style={{ height: 20, width: '60%' }} /></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
