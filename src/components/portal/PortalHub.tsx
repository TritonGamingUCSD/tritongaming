'use client';

import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import styles from './PortalHub.module.css';

export interface HubSection {
  id: string;
  icon: string;
  label: string;
  description: string;
  badge?: string | number;
  content: ReactNode;
}

const SPRING = { type: 'spring' as const, stiffness: 300, damping: 34 };

// Replaces the old sidebar as the portal's primary navigation: a grid of
// section cards that zoom into a full panel on click (Framer Motion's
// shared layoutId morphs the clicked card's box into the panel, and back
// again on close), instead of separate routed pages. Each section's real
// content is pre-rendered server-side and just handed in — this component
// only owns which one is currently open.
//
// mode="popLayout" matters here: without it, the exiting grid and the
// entering panel both sit in normal document flow for one frame, so the
// page is briefly as tall as *both* stacked — the shared-layout animation
// targets that transient (wrong) position, then visibly corrects once the
// grid actually unmounts. popLayout pulls the exiting element out of flow
// immediately so there's only ever one real layout to animate towards.
//
// Which section is open is derived from the URL, not local state — /portal
// and /portal?open=x are the same route, so navigating between them (e.g.
// a plain <Link> elsewhere in the app) never remounts this component; a
// useState initializer would only read the param once and then ignore every
// later change. Reading searchParams directly on every render (it's a
// reactive hook) keeps the two in sync regardless of how "open" changed.
export default function PortalHub({ sections }: { sections: HubSection[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOpen = searchParams.get('open');
  const openId = sections.some((s) => s.id === requestedOpen) ? requestedOpen : null;

  const open = useCallback((id: string) => {
    router.replace(`/portal?open=${id}`, { scroll: false });
  }, [router]);

  const close = useCallback(() => {
    router.replace('/portal', { scroll: false });
  }, [router]);

  const openSection = sections.find((s) => s.id === openId) ?? null;

  return (
    <div className={styles.wrap}>
      <AnimatePresence initial={false} mode="popLayout">
        {openSection ? (
          <motion.div
            key="panel"
            layoutId={`hub-card-${openSection.id}`}
            className={styles.panel}
            transition={SPRING}
          >
            <div className={styles.panelHeader}>
              <button className={styles.backBtn} onClick={close}>
                <span aria-hidden="true">←</span> Dashboard
              </button>
              <div className={styles.panelTitleRow}>
                <span className={styles.panelIcon} aria-hidden="true">{openSection.icon}</span>
                <span className={styles.panelTitle}>{openSection.label}</span>
              </div>
            </div>
            <motion.div
              className={styles.panelBody}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.12, duration: 0.25 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {openSection.content}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            className={styles.grid}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {sections.map((s) => (
              <motion.button
                key={s.id}
                layoutId={`hub-card-${s.id}`}
                className={styles.card}
                onClick={() => open(s.id)}
                transition={SPRING}
              >
                {s.badge !== undefined && s.badge !== 0 && (
                  <span className={styles.cardBadge}>{s.badge}</span>
                )}
                <span className={styles.cardIcon} aria-hidden="true">{s.icon}</span>
                <span className={styles.cardLabel}>{s.label}</span>
                <span className={styles.cardDesc}>{s.description}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
