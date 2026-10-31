'use client';

import { ChevronRight } from 'lucide-react';
import { recordUse } from './dockPicker';
import styles from './PortalHub.module.css';
import { GROUP_ACCENT, GROUP_LABEL } from './hubConstants';
import { GroupedSection, HubSection } from './hubTypes';

// The color-coded, grouped list of everything you can open — the home screen's main content
// on desktop and on mobile alike (one column on a phone).
export function HomeGroups({ groupedSections, open, forYou }: { groupedSections: GroupedSection[]; open: (id: string) => void; forYou: Set<string> }) {
  const picked = groupedSections.flatMap(({ items }) => items).filter((s) => forYou.has(s.id) && s.group !== 'Overview');
  const card = (s: HubSection) => (
    <button
      key={s.id}
      className={styles.card}
      style={{ ['--accent' as string]: GROUP_ACCENT[s.group] }}
      onClick={() => {
        recordUse(s.id);
        open(s.id);
      }}
    >
      <span className={styles.cardIconTile} aria-hidden="true">
        {s.icon}
      </span>
      <span className={styles.cardText}>
        <span className={styles.cardLabel}>{s.label}</span>
        <span className={styles.cardDesc}>{s.description}</span>
      </span>
      {s.badge !== undefined && s.badge !== 0 ? (
        <span className={styles.cardBadge}>{s.badge}</span>
      ) : (
        <ChevronRight size={16} strokeWidth={1.75} className={styles.cardChevron} aria-hidden="true" />
      )}
    </button>
  );
  return (
    <>
      <section className={styles.group} aria-label="For you">
        <h2 className={styles.groupLabel}>For you</h2>
        <div className={styles.grid}>{picked.map(card)}</div>
      </section>
      <details className={styles.allPages}>
        <summary>All pages</summary>
        {/* The Overview group (Profile and Help) lives in the sidebar only; no home card, to save space. */}
        {groupedSections
          .filter(({ group }) => group !== 'Overview')
          .map(({ group, items }) => (
            <section key={group} className={styles.group} style={{ ['--accent' as string]: GROUP_ACCENT[group] }}>
              {groupedSections.length > 1 && (
                <h2 className={styles.groupLabel}>
                  <span className={styles.groupDot} aria-hidden="true" />
                  {GROUP_LABEL[group]}
                  <span className={styles.groupCount}>{items.length}</span>
                </h2>
              )}
              <div className={styles.grid}>
                {items.map((s) => (
                  <button key={s.id} className={styles.card} onClick={() => open(s.id)}>
                    <span className={styles.cardIconTile} aria-hidden="true">
                      {s.icon}
                    </span>
                    <span className={styles.cardText}>
                      <span className={styles.cardLabel}>{s.label}</span>
                      <span className={styles.cardDesc}>{s.description}</span>
                    </span>
                    {s.badge !== undefined && s.badge !== 0 ? (
                      <span className={styles.cardBadge}>{s.badge}</span>
                    ) : (
                      <ChevronRight size={16} strokeWidth={1.75} className={styles.cardChevron} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
      </details>
    </>
  );
}
