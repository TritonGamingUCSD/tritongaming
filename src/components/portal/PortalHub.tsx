'use client';

import { confirmDiscardUnsaved } from '@/lib/useUnsavedChanges';
import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Home, MoreHorizontal, ChevronRight, ChevronLeft } from 'lucide-react';
import PortalSearch from './PortalSearch';
import styles from './PortalHub.module.css';

// The bottom tab bar's fixed slots — Hub + these (whichever a person
// actually has) + More is 5 tabs, max. Battlepass deliberately isn't one
// of these: an officer who's also a UCSD member gets BOTH the 'points' and
// 'battlepass' sections at once (isRewardsEligible and the officer-tier
// check are independent, not mutually exclusive), so giving Battlepass its
// own primary slot too would make the bar 6 items for exactly that
// audience. It's one tap under "More" for everyone instead, same as
// Activity/Members/Admin/etc.
const PRIMARY_TAB_ORDER = ['tickets', 'points', 'profile'];

// Section icons are already sized for the big grid cards (28px) — shrink
// to something that reads as a tab-bar glyph instead of cloning a whole
// second icon set just for this.
function smallIcon(icon: ReactNode, size = 21) {
  if (!isValidElement(icon)) return icon;
  return cloneElement(icon as ReactElement<{ size?: number; strokeWidth?: number }>, { size, strokeWidth: 1.75 });
}

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
// Accent color per group — tints the heading dot, icon tiles and hover state.
const GROUP_ACCENT: Record<string, string> = { Yours: '#ffc72c', Events: '#4a90e2', Resources: '#34d399', Admin: '#f472b6' };
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

export interface HubIdentity { name: string; avatarUrl: string | null; roleLabel: string }

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

export function useIsDesktop(): boolean {
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
// bottom tab bar (+ "More" sheet) that swaps in a section's full-screen
// panel on tap, with a plain fade/slide (see the panel's motion.div below —
// no shared-layout zoom anymore now that there's no card grid left to zoom
// from). On desktop, DesktopShell below takes over instead — see its own
// comment for why. Each section's real content is pre-rendered server-side
// and just handed in — this component only owns which one is currently open.
//
// openId is local state, not derived straight from the URL — every section's
// content is already sitting in `sections` (fetched once, up front), so
// opening a card is a pure UI change and should be instant. Deriving from
// useSearchParams() directly made every click wait on a router.replace()
// round trip (this page is force-dynamic) before the animation could even
// start, which is what made it feel laggy. The URL is still kept in sync —
// via router.replace after the fact, and via the effect below picking up
// changes that arrive from *outside* this component (e.g. a <Link> to
// /portal?section=x elsewhere on the same route) — just without the UI
// waiting on it.
// onOpenChange reports whether a panel is open so a sibling (the portal's
// "next ticket" banner) can react to that directly — e.g. hide itself while
// a section takes over the screen on mobile.
export default function PortalHub({ sections, identity, railFooter, homeExtras, onOpenChange }: { sections: HubSection[]; identity?: HubIdentity; railFooter?: ReactNode; homeExtras?: ReactNode; onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get('section');
  const validRequested = sections.some((s) => s.id === requestedSection) ? requestedSection : null;

  const [openId, setOpenId] = useState<string | null>(validRequested);
  const [moreOpen, setMoreOpen] = useState(false);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    setOpenId(validRequested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validRequested]);

  useEffect(() => {
    // On mobile, opening a section takes over the screen, so the home-only top
    // section (greeting, banners, next ticket) hides. On desktop the sidebar stays
    // next to the section, so the top section stays too.
    onOpenChange?.(!isDesktop && openId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, isDesktop]);

  const open = useCallback((id: string) => {
    // Switching sections would throw away unsaved edits in the open one.
    if (id !== openId && !confirmDiscardUnsaved()) return;
    setOpenId(id);
    router.replace(`/portal?section=${id}`, { scroll: false });
  }, [router, openId]);

  const close = useCallback(() => {
    if (!confirmDiscardUnsaved()) return;
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

  const primaryTabs = PRIMARY_TAB_ORDER
    .map((id) => sections.find((s) => s.id === id))
    .filter((s): s is HubSection => !!s);
  const primaryTabIds = new Set(primaryTabs.map((s) => s.id));
  const moreSections = sections.filter((s) => !primaryTabIds.has(s.id));
  const isMoreActive = openId !== null && !primaryTabIds.has(openId);

  if (isDesktop) {
    return (
      <DesktopShell
        identity={identity}
        railFooter={railFooter}
        homeExtras={homeExtras}
        groupedSections={groupedSections}
        openSection={openSection}
        openId={openId}
        open={open}
        close={close}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <AnimatePresence initial={false}>
        {openSection ? (
          // layoutId (the shared "zoom from the tapped grid card" morph)
          // used to make sense here — it doesn't anymore. That grid is
          // gone from mobile (see the bottom tab bar / "More" sheet
          // instead), so opening a section from a bar tap has no matching
          // source element left anywhere on the page. Framer Motion still
          // set up its full shared-layout projection machinery for a
          // layoutId with no partner (per-frame layout measurement on
          // this panel's entire subtree, tables/charts and all) — that's
          // what was actually causing the reported lag opening tabs/
          // sections, not the fade itself. A plain opacity+slide instead
          // costs nothing close to that.
          <motion.div
            key="panel"
            className={styles.panel}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <div className={styles.panelHeader} style={{ ['--accent' as string]: GROUP_ACCENT[openSection.group] }}>
              <button className={styles.backBtn} onClick={close} aria-label="Back to dashboard">
                <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className={styles.panelIconTile} aria-hidden="true">{smallIcon(openSection.icon, 18)}</span>
              <span className={styles.panelTitle}>{openSection.label}</span>
            </div>
            <div className={styles.panelBody}>
              {openSection.content}
            </div>
          </motion.div>
        ) : null}

      </AnimatePresence>

      <nav className={styles.bottomBar} aria-label="Portal quick navigation">
        <button
          type="button"
          className={`${styles.dockItem} ${openId === null && !moreOpen ? styles.dockItemActive : ''}`}
          onClick={() => { setMoreOpen(false); close(); }}
        >
          <span className={styles.dockIcon}><Home size={20} strokeWidth={1.9} aria-hidden="true" /></span>
          <span className={styles.dockLabel}>Home</span>
        </button>
        {primaryTabs.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.dockItem} ${openId === s.id && !moreOpen ? styles.dockItemActive : ''}`}
            onClick={() => { setMoreOpen(false); open(s.id); }}
          >
            <span className={styles.dockIcon}>
              {smallIcon(s.icon, 20)}
              {s.badge !== undefined && s.badge !== 0 && <span className={styles.dockBadge}>{s.badge}</span>}
            </span>
            <span className={styles.dockLabel}>{s.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`${styles.dockItem} ${isMoreActive || moreOpen ? styles.dockItemActive : ''}`}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <span className={styles.dockIcon}><MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" /></span>
          <span className={styles.dockLabel}>More</span>
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              key="more-backdrop"
              className={styles.moreSheetBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              key="more-sheet"
              className={styles.moreSheet}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING}
            >
              <div className={styles.moreSheetHandle} aria-hidden="true" />
              {railFooter && <div className={styles.sheetFooter}>{railFooter}</div>}
              {GROUP_ORDER.map((group) => {
                const items = moreSections.filter((s) => s.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className={styles.sheetGroup} style={{ ['--accent' as string]: GROUP_ACCENT[group] }}>
                    <div className={styles.sheetGroupLabel}><span className={styles.railGroupDot} aria-hidden="true" />{group}</div>
                    <div className={styles.sheetGrid}>
                      {items.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`${styles.sheetTile} ${openId === s.id ? styles.sheetTileActive : ''}`}
                          onClick={() => { setMoreOpen(false); open(s.id); }}
                        >
                          <span className={styles.sheetTileIcon} aria-hidden="true">
                            {smallIcon(s.icon, 22)}
                            {s.badge !== undefined && s.badge !== 0 && <span className={styles.dockBadge}>{s.badge}</span>}
                          </span>
                          <span className={styles.sheetTileLabel}>{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// The color-coded, grouped list of everything you can open — the home screen's main content
// on desktop and on mobile alike (one column on a phone).
function HomeGroups({ groupedSections, open }: { groupedSections: GroupedSection[]; open: (id: string) => void }) {
  return (
    <>
      {groupedSections.map(({ group, items }) => (
        <section key={group} className={styles.group} style={{ ['--accent' as string]: GROUP_ACCENT[group] }}>
          {groupedSections.length > 1 && (
            <h2 className={styles.groupLabel}>
              <span className={styles.groupDot} aria-hidden="true" />
              {group}
              <span className={styles.groupCount}>{items.length}</span>
            </h2>
          )}
          <div className={styles.grid}>
            {items.map((s) => (
              <button key={s.id} className={styles.card} onClick={() => open(s.id)}>
                <span className={styles.cardIconTile} aria-hidden="true">{s.icon}</span>
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
    </>
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
  identity,
  railFooter,
  homeExtras,
  groupedSections,
  openSection,
  openId,
  open,
  close,
}: {
  identity?: HubIdentity;
  railFooter?: ReactNode;
  homeExtras?: ReactNode;
  groupedSections: GroupedSection[];
  openSection: HubSection | null;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}) {
  return (
    <div className={styles.desktopShell}>
      <aside className={styles.rail}>
        {identity && (
          <button type="button" className={styles.railIdentity} onClick={() => open('profile')} aria-label="Open your profile" title="Your profile">
            {identity.avatarUrl ? (
              <Image src={identity.avatarUrl} alt="" width={40} height={40} className={styles.railAvatar} unoptimized referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.railAvatarFallback}>{identity.name[0]?.toUpperCase() ?? 'T'}</span>
            )}
            <span className={styles.railIdentityText}>
              <span className={styles.railName}>{identity.name}</span>
              <span className={styles.railRole}>{identity.roleLabel}</span>
            </span>
          </button>
        )}
        <nav className={styles.railNav} aria-label="Portal sections">
          <button
            className={`${styles.railItem} ${!openSection ? styles.railItemActive : ''}`}
            style={{ ['--accent' as string]: '#ffc72c' }}
            onClick={close}
            aria-current={!openSection ? 'page' : undefined}
          >
            <span className={styles.railIcon} aria-hidden="true"><Home /></span>
            <span className={styles.railLabel}>Dashboard</span>
          </button>
          {groupedSections.map(({ group, items }) => (
            <div key={group} className={styles.railGroup} style={{ ['--accent' as string]: GROUP_ACCENT[group] }}>
              {groupedSections.length > 1 && (
                <div className={styles.railGroupLabel}><span className={styles.railGroupDot} aria-hidden="true" />{group}</div>
              )}
              {items.map((s) => (
                <button
                  key={s.id}
                  className={`${styles.railItem} ${s.id === openId ? styles.railItemActive : ''}`}
                  onClick={() => open(s.id)}
                  aria-current={s.id === openId ? 'page' : undefined}
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
        {railFooter && <div className={styles.railFooter}>{railFooter}</div>}
      </aside>

      <div className={styles.desktopContent}>
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
              className={styles.gridWrap}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.15 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
            >
              {homeExtras && <div className={styles.homeExtras}>{homeExtras}</div>}
              <HomeGroups groupedSections={groupedSections} open={open} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
