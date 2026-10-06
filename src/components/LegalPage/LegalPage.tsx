import type { ReactNode } from 'react';
import { ZineBand, PageHero } from '@/components/ZineBand/ZineBand';
import styles from './LegalPage.module.css';

// One layout for the legal pages (privacy, terms): the site's page hero, then a plain, readable column of text on a navy band.
export default function LegalPage({ label, title, sub, updated, children }: { label: string; title: string; sub: string; updated: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <PageHero label={label} title={title} sub={sub} />
      <ZineBand tone="navy" edge={false}>
        <article className={styles.doc}>
          <p className={styles.updated}>Last updated {updated}</p>
          {children}
        </article>
      </ZineBand>
    </div>
  );
}

export { styles as legalStyles };
