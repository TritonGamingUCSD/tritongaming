'use client';

import { createPortal } from 'react-dom';
import ScanOpening from './ScanOpening';
import { confirmDiscardUnsaved } from '@/lib/ui/useUnsavedChanges';
import { ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { mergedPortalParams, portalHref } from '@/lib/portal/portalPath';
import { REFRESH_EVENT, REFRESHED_EVENT } from '@/lib/ui/refreshPortal';
import { sectionLabel } from '@/lib/portal/sections';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import { motion, AnimatePresence } from 'motion/react';
import { Home, MoreHorizontal, ChevronRight, ChevronLeft } from 'lucide-react';
import CodeIcon from '@/components/portal/CodeIcon';
import { pickDock, readUsage, recordUse } from './dockPicker';
import GlassDock, { DockEntry } from './GlassDock';
import styles from './PortalHub.module.css';
import mob from './PortalMobile.module.css';
import { roleNeededFor } from '@/lib/portal/portalCommands';
import { CLEAR_NAV, DOCK_ICON_SIZE, GROUP_ACCENT, GROUP_LABEL, GROUP_ORDER, SECTION_ORDER, SPRING } from './hubConstants';
import { smallIcon } from './smallIcon';
import { GroupedSection, HubFrame, HubIdentity, HubSection } from './hubTypes';
import { useIsDesktop } from './useIsDesktop';
import { DesktopShell } from './DesktopShell';
import { PlainShell } from './PlainShell';

export default function PortalHub({
  sections: sectionsProp,
  identity,
  railFooter,
  homeExtras,
  onOpenChange,
  frame,
  plain = false,
}: {
  sections: HubSection[];
  identity?: HubIdentity;
  railFooter?: ReactNode;
  homeExtras?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  frame?: HubFrame;
  /** Guests and UCSD-only accounts: on a desktop, a plain top bar instead of the sidebar app frame. */ plain?: boolean;
}) {
  const sections = useMemo(() => {
    const rank = (id: string) => {
      const i = SECTION_ORDER.indexOf(id);
      return i === -1 ? SECTION_ORDER.length : i;
    };
    return [...sectionsProp].sort((a, b) => rank(a.id) - rank(b.id));
  }, [sectionsProp]);
  const setParams = usePortalParams();
  const rawSearchParams = useSearchParams();
  const pathname = usePathname();
  // Section, tab and subtab live in the path (/portal/docs/read); the hub reads them folded back into one set of params.
  const searchParams = useMemo(() => mergedPortalParams(pathname, rawSearchParams.toString()), [pathname, rawSearchParams]);
  // Old-style addresses (/portal/docs/read, from a link or bookmark) are tidied into the path form in place — no reload.
  useEffect(() => {
    if (rawSearchParams.get('section')) {
      window.history.replaceState(window.history.state, '', portalHref(mergedPortalParams(window.location.pathname, window.location.search)));
    }
  }, [rawSearchParams, pathname]);
  const requestedSection = searchParams.get('section');
  const sectionIdsRef = useRef(new Set<string>());
  sectionIdsRef.current = new Set(sections.map((s) => s.id));
  const validRequested = sections.some((s) => s.id === requestedSection) ? requestedSection : null;

  const [openId, setOpenId] = useState<string | null>(validRequested);
  const [moreOpen, setMoreOpen] = useState(false);
  // Swiping the "More" sheet down closes it: from its top bar, or from anywhere on it while the list is scrolled to the
  // top. Plain pointer handling with a CSS `translate` (not a motion drag), so it can't interfere with the list's own
  // touch scrolling. `sheetDy` is how far it has been pulled down right now.
  const [sheetDy, setSheetDy] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetGesture = useRef<{ startY: number; lastY: number; lastT: number; v: number; active: boolean; fromGrab: boolean } | null>(null);
  const sheetEl = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moreOpen) {
      setSheetDy(0);
      setSheetDragging(false);
      sheetGesture.current = null;
    }
  }, [moreOpen]);
  const sheetStart = (y: number, fromGrab: boolean) => {
    // From the body only when the list is at its top (otherwise it's an ordinary scroll).
    if (!fromGrab && (sheetEl.current?.scrollTop ?? 0) > 0) {
      sheetGesture.current = null;
      return;
    }
    sheetGesture.current = { startY: y, lastY: y, lastT: performance.now(), v: 0, active: false, fromGrab };
  };
  const sheetMove = (y: number) => {
    const g = sheetGesture.current;
    if (!g) return;
    const dy = y - g.startY;
    if (!g.active) {
      // Start pulling only for a clear downward move (and, from the body, only if the list is still at the top).
      if (dy > 6 && (g.fromGrab || (sheetEl.current?.scrollTop ?? 0) <= 0)) {
        g.active = true;
        setSheetDragging(true);
      } else if (dy < -6) {
        sheetGesture.current = null;
        return;
      } else return;
    }
    const now = performance.now();
    g.v = (y - g.lastY) / Math.max(1, now - g.lastT);
    g.lastY = y;
    g.lastT = now;
    setSheetDy(Math.max(0, dy));
  };
  const sheetEnd = () => {
    const g = sheetGesture.current;
    sheetGesture.current = null;
    if (!g?.active) return;
    setSheetDragging(false);
    if (sheetDy > 90 || g.v > 0.6) setMoreOpen(false);
    else setSheetDy(0);
  };
  // A notification link can point at another tab (or a specific item) of the section that's already
  // open. Sections read their starting tab from the URL when they mount, so remount once the URL has
  // changed. In-section tab clicks never do this (they only edit the URL themselves).
  const [navNonce, setNavNonce] = useState(0);
  const [openingScan, setOpeningScan] = useState(false); // the Scan button was pressed: a screen shows at once while the camera page loads
  useEffect(() => {
    if (!openingScan) return;
    const id = window.setTimeout(() => setOpeningScan(false), 10_000);
    return () => window.clearTimeout(id);
  }, [openingScan]);
  const pendingNav = useRef(false);
  const navFrom = useRef<string | null>(null); // the section that was open when the link was followed
  const openIdNow = useRef<string | null>(null);
  openIdNow.current = openId;
  // A link to a section that was not open already mounts it fresh, so only a link into the section that is already open needs it rebuilt (a second rebuild
  // made things like the ticket pop-up flash twice).
  const rebuildIfSameSection = () => {
    if (!pendingNav.current) return;
    pendingNav.current = false;
    const target = mergedPortalParams(window.location.pathname, window.location.search).get('section');
    if (target && target === navFrom.current) setNavNonce((n) => n + 1);
  };
  // Browser Back/Forward between portal views: the address changes under us, so remount the open section to re-read its tab.
  useEffect(() => {
    const onPop = () => {
      const w = window as unknown as { __tgPop?: number; __tgPush?: number };
      w.__tgPop = Date.now();
      w.__tgPush = Math.max(0, (w.__tgPush ?? 0) - 1); // Back/Forward may land on another section (or home): show the one the address now names.
      const id = mergedPortalParams(window.location.pathname, window.location.search).get('section');
      setOpenId(id && sectionIdsRef.current.has(id) ? id : null);
      window.setTimeout(() => setNavNonce((n) => n + 1), 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    const onNav = () => {
      pendingNav.current = true;
      navFrom.current = openIdNow.current;
      window.setTimeout(rebuildIfSameSection, 600);
    };
    window.addEventListener('tg:portal-nav', onNav);
    return () => window.removeEventListener('tg:portal-nav', onNav);
  }, []);
  // A link or search result inside the portal changes the address with the history API; Next doesn't report that to
  // usePathname, so read the address again on the portal's own navigation event.
  useEffect(() => {
    const sync = () => {
      const id = mergedPortalParams(window.location.pathname, window.location.search).get('section');
      const ok = !!id && sectionIdsRef.current.has(id);
      setOpenId(ok ? id : null);
    };
    window.addEventListener('tg:portal-nav', sync);
    return () => window.removeEventListener('tg:portal-nav', sync);
  }, []);
  const paramsKey = searchParams.toString();
  useEffect(() => {
    rebuildIfSameSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);
  const isDesktop = useIsDesktop();

  useEffect(() => {
    setOpenId(validRequested);
  }, [validRequested]);

  useEffect(() => {
    // On mobile, opening a section takes over the screen, so the home-only top
    // section (greeting, banners, next ticket) hides. On desktop the sidebar stays
    // next to the section, so the top section stays too.
    onOpenChange?.(!isDesktop && openId !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, isDesktop]);

  const open = useCallback(
    (id: string) => {
      // Switching sections would throw away unsaved edits in the open one.
      if (id !== openId && !confirmDiscardUnsaved()) return;
      // Help records which page the person came from, to attach to their ticket.
      if (id === 'help') {
        try {
          sessionStorage.setItem('tg_help_from', openId ?? 'home');
        } catch {
          /* ignore */
        }
      }
      // Choosing the section you are already in goes back to its first tab (the section is rebuilt), not wherever you left it.
      if (id === openId) setNavNonce((n) => n + 1);
      setOpenId(id);
      // Pure UI change — every section's content is already on the page — so update the address bar
      // directly. (router.replace re-rendered the whole portal on the server and, being slow, could
      // finish after a later click and snap the view back to an older section.)
      setParams({ section: id, ...CLEAR_NAV });
    },
    [setParams, openId],
  );

  const close = useCallback(() => {
    if (!confirmDiscardUnsaved()) return;
    setOpenId(null);
    setParams({ section: null, ...CLEAR_NAV });
  }, [setParams]);

  const openSection = sections.find((s) => s.id === openId) ?? null;

  // A link to a page this person's roles don't include (a UCSD student or someone with no role following a shared
  // link, say) used to just land on home with no explanation. Point them to Help, which explains how to get the role.
  const lockedSection = requestedSection && !validRequested && SECTION_ORDER.includes(requestedSection) && requestedSection !== 'help' ? sectionLabel(requestedSection) : null;
  const neededRole = lockedSection && requestedSection ? roleNeededFor(requestedSection) : null;
  const [lockedDismissed, setLockedDismissed] = useState(false);
  const lockedNotice =
    lockedSection && !lockedDismissed ? (
      <div className={styles.lockedNotice} role="status">
        <span>
          <strong>{lockedSection}</strong>{' '}
          {neededRole
            ? `is for ${neededRole}s and above. If you think you should have it, open Help and ask.`
            : 'needs a role your account doesn’t have yet. Open Help to see which role it is and how to get it.'}
        </span>
        <span className={styles.lockedActions}>
          <button type="button" className={styles.lockedHelp} onClick={() => open('help')}>
            Open Help
          </button>
          <button type="button" className={styles.lockedClose} onClick={() => setLockedDismissed(true)} aria-label="Dismiss">
            ×
          </button>
        </span>
      </div>
    ) : null;
  const frameWithNotice: HubFrame | undefined =
    frame && lockedNotice
      ? {
          ...frame,
          banners: (
            <>
              {frame.banners}
              {lockedNotice}
            </>
          ),
        }
      : frame;

  // Groups a plain member actually qualifies for (just Tickets/Profile/
  // Activity) only render that one section, no empty "Community"/"Staff &
  // Admin" headers with nothing under them — capability gating already
  // decides which sections exist at all (see portal/page.tsx), this just
  // decides how the ones that do exist are clustered.
  const groupedSections: GroupedSection[] = GROUP_ORDER.map((group) => ({ group, items: sections.filter((s) => s.group === group) })).filter((g) => g.items.length > 0);

  // Server render and first paint use the role/context defaults; once mounted, what this person
  // actually opens and the time of week are folded in.
  const router = useRouter();
  // A refresh (button, pull-down, or coming back to the app): the server's data for this page is fetched again and, once it has arrived, the open section is rebuilt with it. The address, the tab and
  // the page stay as they are.
  const [refreshPending, startRefresh] = useTransition();
  const wasPending = useRef(false);
  const keepScroll = useRef(0); // where the page was scrolled to when a refresh began: the rebuilt section is put back there
  const keepUrl = useRef(''); // the address when a refresh began: Next's refresh brings back the address the page was first loaded with (it does not know the portal moved the address itself), so it is put back
  useEffect(() => {
    const on = () => {
      keepScroll.current = window.scrollY;
      keepUrl.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      startRefresh(() => router.refresh());
    };
    window.addEventListener(REFRESH_EVENT, on);
    return () => window.removeEventListener(REFRESH_EVENT, on);
  }, [router]);
  useEffect(() => {
    if (refreshPending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false; // the server's answer has been applied: rebuild the open section with it
    // First the address goes back to where the person was (the rebuilt section reads it to know which page, tab and view to show).
    const url = keepUrl.current;
    if (url && `${window.location.pathname}${window.location.search}${window.location.hash}` !== url) window.history.replaceState(window.history.state, '', url);
    setNavNonce((n) => n + 1);
    // The rebuilt section is shorter for a moment while it loads, which would drop the page back to the top: keep putting it where it was until it has grown tall enough.
    const y = keepScroll.current;
    if (y > 0) {
      let tries = 0;
      const id = window.setInterval(() => {
        window.scrollTo(0, y);
        if (Math.abs(window.scrollY - y) < 2 || ++tries > 25) window.clearInterval(id);
      }, 80);
    }
    window.dispatchEvent(new Event(REFRESHED_EVENT));
  }, [refreshPending]);
  // Five slots: Home, two pages, the scanner in the middle... so the bar keeps two pages, then More.
  const [dock, setDock] = useState(() => pickDock(sections, { slots: 2 }));
  const dockKey = sections.map((s) => `${s.id}:${s.dockBoost ?? 0}:${s.dockExclude ? 'x' : ''}`).join(',');
  useEffect(() => {
    setDock(pickDock(sections, { now: new Date(), usage: readUsage(), slots: 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockKey]);
  // "For you": the few pages this person most likely wants (their role, what they open most on this device, the time of week),
  // so home is not a wall of every page. The rest sit behind "All pages".
  const [forYou, setForYou] = useState(() => pickDock(sections, { slots: 6, desk: true }).ids);
  useEffect(() => {
    setForYou(pickDock(sections, { now: new Date(), usage: readUsage(), slots: 6, desk: true }).ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockKey]);
  const primaryTabs = sections.filter((s) => dock.ids.has(s.id));
  // The phone's bottom bar (GlassDock): Home, the two slots the dock picker chose with Scan between them (one camera for every QR the portal makes, see UniversalScanner), and More.
  const dockItems: DockEntry[] = [];
  dockItems.push({
    id: 'home',
    label: 'Home',
    icon: <Home size={20} strokeWidth={1.9} aria-hidden="true" />,
    active: openId === null && !moreOpen,
    onClick: () => {
      setMoreOpen(false);
      close();
    },
  });
  const scanEntry: DockEntry = {
    id: 'scan',
    label: 'Scan',
    raised: true,
    ariaLabel: 'Scan a code',
    icon: <CodeIcon size={24} />,
    onClick: () => {
      setMoreOpen(false);
      setOpeningScan(true);
      router.push('/portal/scan');
    },
  };
  primaryTabs.forEach((sec, i) => {
    if (i === 1) dockItems.push(scanEntry);
    dockItems.push({
      id: sec.id,
      label: (sec.dockLabel ?? sec.label).replace(/^My /, ''),
      active: openId === sec.id && !moreOpen,
      urgent: dock.urgent.has(sec.id),
      badge: sec.badge,
      icon: smallIcon(sec.icon, DOCK_ICON_SIZE[sec.id] ?? 20),
      onClick: () => {
        setMoreOpen(false);
        recordUse(sec.id);
        open(sec.id);
      },
    });
  });
  if (primaryTabs.length < 2) dockItems.push(scanEntry);
  const primaryTabIds = new Set(primaryTabs.map((s) => s.id));
  const moreSections = sections.filter((s) => !primaryTabIds.has(s.id));
  const isMoreActive = openId !== null && !primaryTabIds.has(openId);
  if (moreSections.length > 0)
    dockItems.push({
      id: 'more',
      label: 'More',
      active: isMoreActive || moreOpen,
      expanded: moreOpen,
      icon: <MoreHorizontal size={20} strokeWidth={1.9} aria-hidden="true" />,
      onClick: () => setMoreOpen((v) => !v),
    });

  if (isDesktop && plain) {
    return (
      <PlainShell
        identity={identity}
        homeExtras={homeExtras}
        groupedSections={groupedSections}
        openSection={openSection}
        openId={openId}
        open={open}
        close={close}
        frame={frameWithNotice}
        navNonce={navNonce}
      />
    );
  }

  if (isDesktop) {
    return (
      <DesktopShell
        identity={identity}
        homeExtras={homeExtras}
        groupedSections={groupedSections}
        openSection={openSection}
        openId={openId}
        open={open}
        close={close}
        frame={frameWithNotice}
        navNonce={navNonce}
        forYou={forYou}
      />
    );
  }

  // Phone tiles (home and More): one continuous grid in group order, colored by group, with no per-group headings, so a group with
  // one or two sections doesn't leave a mostly empty row behind.
  const tilesInOrder = (list: HubSection[]) => GROUP_ORDER.flatMap((g) => list.filter((x) => x.group === g));
  const renderTile = (s: HubSection, inSheet: boolean) => (
    <button
      key={s.id}
      type="button"
      className={`${mob.row} ${inSheet && openId === s.id ? mob.rowActive : ''}`}
      onClick={() => {
        if (inSheet) setMoreOpen(false);
        recordUse(s.id);
        open(s.id);
      }}
    >
      <span className={mob.rowText}>
        <span className={mob.rowLabel}>{s.label}</span>
        <span className={mob.rowDesc}>{s.description}</span>
      </span>
      {s.badge !== undefined && s.badge !== 0 && <span className={mob.rowBadge}>{s.badge}</span>}
      <ChevronRight size={16} strokeWidth={1.75} className={mob.rowGo} aria-hidden="true" />
    </button>
  );

  return (
    <div className={styles.wrap}>
      {/* Home on a phone is also the launcher: every section you can open, grouped, one tap away (the bar and More are shortcuts). */}
      {!openSection && (
        <div className={styles.launcher}>
          <h2 className={styles.forYouLabel}>For you</h2>
          <div className={`${mob.list} ${mob.compact}`}>
            {tilesInOrder(sections)
              .filter((s) => forYou.has(s.id))
              .map((s) => renderTile(s, false))}
          </div>
          {sections.some((s) => !forYou.has(s.id)) && (
            <details className={styles.allPages}>
              <summary>All pages</summary>
              <div className={`${mob.list} ${mob.compact}`}>
                {tilesInOrder(sections)
                  .filter((s) => !forYou.has(s.id))
                  .map((s) => renderTile(s, false))}
              </div>
            </details>
          )}
        </div>
      )}
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
            style={{ ['--accent' as string]: GROUP_ACCENT[openSection.group] }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            <div className={`${styles.panelHeader} pp-dark`} style={{ ['--accent' as string]: GROUP_ACCENT[openSection.group] }}>
              <button className={styles.backBtn} onClick={close} aria-label="Back to dashboard">
                <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
              </button>
              <span className={styles.panelTitle}>
                <span className={styles.crumbGroup}>{GROUP_LABEL[openSection.group]}</span>
                {openSection.label}
              </span>
            </div>
            <div className={styles.panelBody}>
              <Fragment key={navNonce}>{openSection.content}</Fragment>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GlassDock items={dockItems} />
      {openingScan && createPortal(<ScanOpening />, document.body)}

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
              style={{ translate: `0 ${sheetDy}px`, transition: sheetDragging ? 'none' : 'translate 0.2s ease-out' }}
              onTouchStart={(e) => sheetStart(e.touches[0].clientY, !!(e.target as Element).closest('[data-sheet-grab]'))}
              onTouchMove={(e) => sheetMove(e.touches[0].clientY)}
              onTouchEnd={sheetEnd}
              onTouchCancel={sheetEnd}
            >
              <div
                className={styles.moreSheetGrab}
                data-sheet-grab=""
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                    sheetStart(e.clientY, true);
                  }
                }}
                onPointerMove={(e) => {
                  if (e.pointerType === 'mouse') sheetMove(e.clientY);
                }}
                onPointerUp={(e) => {
                  if (e.pointerType === 'mouse') sheetEnd();
                }}
              >
                <div className={styles.moreSheetHandle} aria-hidden="true" />
              </div>
              {/* The list scrolls inside the sheet; the sheet itself (handle included) is what moves when it is swiped down. */}
              <div className={styles.moreSheetScroll} ref={sheetEl}>
                {railFooter && <div className={styles.sheetFooter}>{railFooter}</div>}
                <div className={mob.list}>{tilesInOrder(moreSections).map((s) => renderTile(s, true))}</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
