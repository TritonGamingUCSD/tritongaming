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
// 'Tools' used to be its own group with exactly one card (QR Studio) in
// it — a group that never clusters more than a single item isn't helping
// anyone scan faster, it's just an extra label to read past. QR Studio
// moved into Resources instead (see portal/page.tsx) — it's usable by any
// officer-tier member, the same audience as Members/Docs, not Admin's
// actually-restricted stuff.
const GROUP_ORDER = ['Yours', 'Events', 'Resources', 'Admin'] as const;
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

// Below this, PortalHub renders the mobile experience: a card grid that
// zooms into a full-screen panel on tap, one screen at a time — correct for
// a small display where there's no room for anything to stay persistently
// on screen. Above it, a persistent sidebar takes over (see DesktopShell) —
// having *both* a sidebar and a full-page card takeover competing as two
// different navigation ideas at once was exactly what read as inconsistent/
// "mobile design stretched wide" on desktop. Chosen to match the rail's own
// CSS breakpoint (PortalHub.module.css) so JS and CSS never disagree about
// which mode is active.
const DESKTOP_BREAKPOINT = '(min-width: 900px)';

function useIsDesktop(): boolean {
  // Starts false (the SSR-safe default — the server has no window to check)
  // and corrects on mount. A real desktop visitor sees one frame of the
  // mobile layout before this flips, which is the standard, accepted
  // trade-off for a media-query-driven layout split that can't be resolved
  // server-side.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_BREAKPOINT);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

interface GroupedSection {
  group: HubGroup;
  items: HubSection[];
}

// Replaces the old sidebar as the portal's primary navigation on mobile: a
// grid of section cards that zoom into a full panel on click (Framer
// Motion's shared layoutId morphs the clicked card's box into the panel,
// and back again on close). On desktop, DesktopShell below takes over
// instead — see its own comment for why. Each section's real content is
// pre-rendered server-side and just handed in — this component only owns
// which one is currently open.
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
// panel is open (mobile) there's nothing to measure, so the width stays at
// whatever it last was, which no longer corresponds to anything actually
// visible. onOpenChange reports whether a panel is open so a sibling can
// react to that directly — e.g. hide itself.
export default function PortalHub({ sections, onGridWidth, onOpenChange }: { sections: HubSection[]; onGridWidth?: (width: number) => void; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOpen = searchParams.get('open');
  const validRequested = sections.some((s) => s.id === requestedOpen) ? requestedOpen : null;

  const [openId, setOpenId] = useState<string | null>(validRequested);
  const isDesktop = useIsDesktop();

  const gridRef = useCallback((node: HTMLDivElement | null) => {
    // Matching the hero banner's width to the card cluster's own measured
    // width is a mobile-specific visual idea (centering a banner above a
    // centered, variable-count card grid). Desktop's rail+content shell has
    // no equivalent "cluster to align with" — the home grid there is just
    // left-aligned content in a wide pane, not a floating centered cluster
    // — so measuring it and applying that number as the banner's max-width
    // was capping the banner to whatever the (much narrower) home-grid
    // measurement happened to be, then leaving it stuck at that stale
    // number once you navigated into a section and the grid unmounted,
    // which is what read as the banner's width randomly "jumping" between
    // tabs. Skipping this on desktop entirely lets the banner just stretch
    // to its flex parent's full width instead (see PortalTopSection).
    if (!node || !onGridWidth || isDesktop) return;

    // .grid itself is a block box that always stretches to fill its
    // container's full width — justify-content:center only repositions the
    // *tracks* (cards) inside that box, it doesn't shrink the box to fit
    // them. So measuring the grid element's own rect reports the full
    // container width, not the card cluster's actual span. Measure the real
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
  }, [isDesktop]);

  useEffect(() => {
    setOpenId(validRequested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRequested]);

  useEffect(() => {
    // On desktop, a section being open no longer hides anything the way it
    // does on mobile (the sidebar and everything around it stays put) — so
    // a sibling like the "next ticket" banner has no reason to disappear
    // there. Only report "open" (and let that sibling hide itself) on
    // mobile, where opening a section really does take over the screen.
    onOpenChange?.(!isDesktop && openId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, isDesktop]);

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
  const groupedSections: GroupedSection[] = GROUP_ORDER
    .map((group) => ({ group, items: sections.filter((s) => s.group === group) }))
    .filter((g) => g.items.length > 0);

  if (isDesktop) {
    return (
      <DesktopShell
        groupedSections={groupedSections}
        openSection={openSection}
        openId={openId}
        open={open}
        close={close}
        gridRef={gridRef}
      />
    );
  }

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
              animate={{ opacity: 1, transition: { delay: 0.06, duration: 0.18 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {openSection.content}
            </motion.div>
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

// The desktop layout: a sidebar that's on screen at all times — for the
// home grid *and* for whatever section is open — instead of the mobile
// full-page takeover. Content still swaps (grid <-> section, and section
// <-> section when the rail is clicked), just as a plain crossfade in
// place, not a shared-layout zoom: there's no card on screen to zoom
// from/to once you're not looking at the grid, so trying to fake that
// animation here would be more fragile than useful. The zoom stays exactly
// where it earns its keep — the first tap on mobile.
function DesktopShell({
  groupedSections,
  openSection,
  openId,
  open,
  close,
  gridRef,
}: {
  groupedSections: GroupedSection[];
  openSection: HubSection | null;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  gridRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div className={styles.desktopShell}>
      <nav className={styles.rail} aria-label="Portal sections">
        <button
          className={`${styles.railHome} ${!openSection ? styles.railItemActive : ''}`}
          onClick={close}
        >
          Dashboard
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

      <div className={styles.desktopContent}>
        {/* Only on the home view — once you're inside a section, the rail
            (always visible now) is already the fastest way to go anywhere
            else, so search staying pinned here too would just be a second,
            redundant "get me somewhere" control on screen at once. */}
        {!openSection && <PortalSearch />}
        <AnimatePresence mode="wait" initial={false}>
          {openSection ? (
            <motion.div
              key={openSection.id}
              className={styles.desktopPanel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              <div className={styles.desktopPanelHeader}>
                <span className={styles.panelIcon} aria-hidden="true">{openSection.icon}</span>
                <span className={styles.panelTitle}>{openSection.label}</span>
              </div>
              <div className={styles.panelBody}>{openSection.content}</div>
            </motion.div>
          ) : (
            <motion.div
              key="home"
              ref={gridRef}
              className={styles.gridWrap}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {groupedSections.map(({ group, items }) => (
                <section key={group} className={styles.group}>
                  {groupedSections.length > 1 && <h2 className={styles.groupLabel}>{group}</h2>}
                  <div className={styles.grid}>
                    {items.map((s) => (
                      <button
                        key={s.id}
                        className={styles.card}
                        onClick={() => open(s.id)}
                        aria-label={`${s.label} — ${s.description}`}
                      >
                        {s.badge !== undefined && s.badge !== 0 && (
                          <span className={styles.cardBadge}>{s.badge}</span>
                        )}
                        <span className={styles.cardIcon} aria-hidden="true">{s.icon}</span>
                        <span className={styles.cardLabel}>{s.label}</span>
                        <span className={styles.cardTooltip} role="tooltip">{s.description}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
