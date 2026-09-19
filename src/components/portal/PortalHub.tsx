'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import PortalSearch from './PortalSearch';
import styles from './PortalHub.module.css';

// Fixed display order — a section's own `group` string just needs to match
// one of these keys. Anything with a group not listed here (shouldn't
// happen, but not worth a hard crash over) falls into its own "More"
// bucket at the end rather than silently vanishing.
const GROUP_ORDER = ['Yours', 'Events', 'Resources', 'Tools', 'Admin'] as const;
type HubGroup = (typeof GROUP_ORDER)[number];

export interface HubSection {
  id: string;
  icon: ReactNode;
  label: string;
  description: string;
  badge?: string | number;
  content: ReactNode;
  group: HubGroup;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 38 };

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
// openId is local state, not derived straight from the URL — every section's
// content is already sitting in `sections` (fetched once, up front), so
// opening a card is a pure UI change and should be instant. Deriving from
// useSearchParams() directly made every click wait on a router.replace()
// round trip (this page is force-dynamic) before the animation could even
// start, which is what made it feel laggy. The URL is still kept in sync —
// via router.replace after the fact, and via the effect below picking up
// changes that arrive from *outside* this component (e.g. a <Link> to
// /portal?open=x elsewhere on the same route) — just without the UI waiting
// on it.
// onGridWidth, when passed, reports the card grid's actual rendered width
// (in px) — lets a sibling like the portal's "next ticket" banner match it
// exactly instead of guessing at a shared width in pure CSS, which broke
// down once real content was involved (see DashboardClient/dashboard.module
// .css for why). It only fires while the grid itself is on screen — while a
// panel is open there's nothing to measure, so the width stays at whatever
// it last was, which no longer corresponds to anything actually visible
// (the panel has its own, different, width). onOpenChange reports whether
// a panel is open so a sibling can react to that directly — e.g. hide
// itself — rather than a stale grid-width value quietly meaning something
// different once a panel opens.
export default function PortalHub({ sections, onGridWidth, onOpenChange }: { sections: HubSection[]; onGridWidth?: (width: number) => void; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOpen = searchParams.get('open');
  const validRequested = sections.some((s) => s.id === requestedOpen) ? requestedOpen : null;

  const [openId, setOpenId] = useState<string | null>(validRequested);

  const gridRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !onGridWidth) return;

    // .grid itself is a block box that always stretches to fill .wrap's
    // full width — justify-content:center only repositions the *tracks*
    // (cards) inside that box, it doesn't shrink the box to fit them. So
    // measuring the grid element's own rect reports the full container
    // width, not the card cluster's actual span. Measure the real
    // leftmost/rightmost card edges instead.
    const measure = () => {
      const cards = node.querySelectorAll<HTMLElement>(`.${styles.card}`);
      if (cards.length === 0) return null;
      let minLeft = Infinity;
      let maxRight = -Infinity;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        minLeft = Math.min(minLeft, rect.left);
        maxRight = Math.max(maxRight, rect.right);
      });
      return maxRight > minLeft ? Math.round(maxRight - minLeft) : null;
    };

    // Cards carry layoutId and animate (the shared-element transition back
    // from a just-closed panel, or the initial mount) — measuring mid-
    // animation can catch a card at a transformed/inflated rect, and since
    // nothing re-triggers a measurement afterward (ResizeObserver only
    // fires on *this container's own* box size changing, not on a child's
    // transform), a bad one-off reading stuck permanently — the banner
    // rendering wider than the actual settled card cluster was this: not a
    // math error, a timing one. Settle-detect instead of trusting a single
    // read: keep sampling on animation frames until two consecutive
    // samples agree (or we give up after ~1s and take the last one).
    let attempts = 0;
    let lastWidth: number | null = null;
    let rafId = 0;
    const settle = () => {
      const width = measure();
      if (width !== null) {
        if (width === lastWidth) {
          onGridWidth(width);
          return;
        }
        lastWidth = width;
      }
      attempts++;
      if (attempts < 60) {
        rafId = requestAnimationFrame(settle);
      } else if (lastWidth !== null) {
        onGridWidth(lastWidth);
      }
    };
    rafId = requestAnimationFrame(settle);

    const ro = new ResizeObserver(() => {
      attempts = 0;
      lastWidth = null;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(settle);
    });
    ro.observe(node);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOpenId(validRequested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRequested]);

  useEffect(() => {
    onOpenChange?.(openId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const open = useCallback((id: string) => {
    setOpenId(id);
    router.replace(`/portal?open=${id}`, { scroll: false });
  }, [router]);

  const close = useCallback(() => {
    setOpenId(null);
    router.replace('/portal', { scroll: false });
  }, [router]);

  const openSection = sections.find((s) => s.id === openId) ?? null;

  // Groups a plain member actually qualifies for (just Tickets/Profile/
  // Activity) only render that one section, no empty "Community"/"Staff &
  // Admin" headers with nothing under them — capability gating already
  // decides which sections exist at all (see portal/page.tsx), this just
  // decides how the ones that do exist are clustered.
  const groupedSections = GROUP_ORDER
    .map((group) => ({ group, items: sections.filter((s) => s.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={styles.wrap}>
      {!openSection && <PortalSearch />}
      <AnimatePresence initial={false} mode="popLayout">
        {openSection ? (
          <motion.div
            key="panel"
            layoutId={`hub-card-${openSection.id}`}
            className={styles.panel}
            transition={SPRING}
          >
            {/* Desktop only (see the min-width media query in the CSS) — a
                persistent rail so switching sections is a click, not a trip
                back to the grid first. Hidden on mobile, where the grid +
                full-panel zoom (unchanged below) already fits a small
                screen correctly; this was the part that read as "a phone
                app stretched wide" on desktop — opening anything took over
                the *entire* window with no persistent nav, same as a phone,
                regardless of how much width was actually available. */}
            <nav className={styles.rail} aria-label="Portal sections">
              <button className={styles.railBack} onClick={close}>
                <span aria-hidden="true">←</span> Dashboard
              </button>
              {groupedSections.map(({ group, items }) => (
                <div key={group} className={styles.railGroup}>
                  {groupedSections.length > 1 && <div className={styles.railGroupLabel}>{group}</div>}
                  {items.map((s) => (
                    <button
                      key={s.id}
                      className={`${styles.railItem} ${s.id === openId ? styles.railItemActive : ''}`}
                      onClick={() => open(s.id)}
                    >
                      <span className={styles.railIcon} aria-hidden="true">{s.icon}</span>
                      <span className={styles.railLabel}>{s.label}</span>
                      {s.badge !== undefined && s.badge !== 0 && (
                        <span className={styles.railBadge}>{s.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </nav>

            <div className={styles.panelMain}>
              <div className={styles.panelHeader}>
                <button className={styles.backBtn} onClick={close}>
                  <span aria-hidden="true">←</span> Dashboard
                </button>
                <div className={styles.panelTitleRow}>
                  <span className={styles.panelIcon} aria-hidden="true">{openSection.icon}</span>
                  <span className={styles.panelTitle}>{openSection.label}</span>
                </div>
              </div>
              {/* Keyed by section id, separate from the outer AnimatePresence
                  above — that one owns the big grid<->panel shared-layout
                  zoom (only relevant for the *first* open from a grid card).
                  This inner one just crossfades the content when the rail
                  switches sections without ever leaving panel view, which
                  has no grid card to zoom from/to in the first place. */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={openSection.id}
                  className={styles.panelBody}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.06, duration: 0.18 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                >
                  {openSection.content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            ref={gridRef}
            className={styles.gridWrap}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {groupedSections.map(({ group, items }) => (
              <section key={group} className={styles.group}>
                {/* Skip the label entirely when it's the only group showing
                    (e.g. a brand-new member with just Yours) — a lone
                    heading above the whole hub reads as clutter, not
                    structure, when there's nothing else to distinguish it
                    from. */}
                {groupedSections.length > 1 && <h2 className={styles.groupLabel}>{group}</h2>}
                <div className={styles.grid}>
                  {items.map((s) => (
                    <motion.button
                      key={s.id}
                      layoutId={`hub-card-${s.id}`}
                      className={styles.card}
                      onClick={() => open(s.id)}
                      transition={SPRING}
                      aria-label={`${s.label} — ${s.description}`}
                    >
                      {s.badge !== undefined && s.badge !== 0 && (
                        <span className={styles.cardBadge}>{s.badge}</span>
                      )}
                      <span className={styles.cardIcon} aria-hidden="true">{s.icon}</span>
                      <span className={styles.cardLabel}>{s.label}</span>
                      {/* Hover/focus-only — the compact card lost its always-on
                          description line (hard to read, ate space), but a
                          first-time visitor still needs a way to tell what a
                          card actually does before committing to opening it.
                          Pure CSS reveal, no JS state; doesn't help touch
                          devices, but tapping to open *is* the discovery
                          mechanism there, so nothing is actually lost. */}
                      <span className={styles.cardTooltip} role="tooltip">{s.description}</span>
                    </motion.button>
                  ))}
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
