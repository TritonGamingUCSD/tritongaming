'use client';

import { ReactNode } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Pin, PinOff } from 'lucide-react';
import CodeBox from '@/components/portal/CodeBox';
import PortalSearch from './PortalSearch';
import NotificationBell from './NotificationBell';
import PortalCrumbs from './PortalCrumbs';
import styles from './PortalHub.module.css';
import { smallIcon } from './smallIcon';
import ByteMini from '@/components/Bytecode/ByteMini';
import AccountMenu from './AccountMenu';
import AreaPixelIcon from './AreaPixelIcon';
import { DASHBOARD_ACCENT, GROUP_ACCENT, GROUP_LABEL } from './hubConstants';
import { GroupedSection, HubFrame, HubIdentity, HubSection } from './hubTypes';
import { HomeGroups } from './HomeGroups';

// The desktop layout: a sidebar that's on screen at all times — for the
// home grid *and* for whatever section is open — instead of the mobile
// full-page takeover. Content still swaps (grid <-> section, and section
// <-> section when the rail is clicked), just as a plain crossfade in
// place, not a shared-layout zoom: there's no card on screen to zoom
// from/to once you're not looking at the grid, so trying to fake that
// animation here would be more fragile than useful. The zoom stays exactly
// where it earns its keep — the first tap on mobile.
export function DesktopShell({
  identity,
  homeExtras,
  groupedSections,
  openSection,
  openId,
  open,
  close,
  frame,
  navNonce,
  forYou,
}: {
  frame?: HubFrame;
  identity?: HubIdentity;
  homeExtras?: ReactNode;
  groupedSections: GroupedSection[];
  openSection: HubSection | null;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  navNonce: number;
  forYou: Set<string>;
}) {
  // Icon-only sidebar: remembered per browser. Read after mount so server and first client render match.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('tg_rail_collapsed') === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const n = !c;
      try {
        localStorage.setItem('tg_rail_collapsed', n ? '1' : '0');
      } catch {
        /* ignore */
      }
      return n;
    });
  // The last pages opened, kept in this browser: the three before the current one are listed under the areas.
  const recentRaw = useSyncExternalStore(
    (cb) => {
      window.addEventListener('tg:recent', cb);
      return () => window.removeEventListener('tg:recent', cb);
    },
    () => {
      try {
        return localStorage.getItem('tg_recent_sections') ?? '[]';
      } catch {
        return '[]';
      }
    },
    () => '[]',
  );
  const openId0 = openSection?.id;
  useEffect(() => {
    if (!openId0) return;
    try {
      const cur = JSON.parse(localStorage.getItem('tg_recent_sections') ?? '[]') as string[];
      const next = [openId0, ...cur.filter((x) => x !== openId0)].slice(0, 6);
      localStorage.setItem('tg_recent_sections', JSON.stringify(next));
      window.dispatchEvent(new Event('tg:recent'));
    } catch {
      /* not remembered */
    }
  }, [openId0]);
  const allItems = groupedSections.flatMap((g) => g.items).filter((x) => !x.railHidden);
  const recent = (() => {
    try {
      return (JSON.parse(recentRaw) as string[])
        .filter((id) => id !== openId0)
        .map((id) => allItems.find((x) => x.id === id))
        .filter((x): x is HubSection => !!x)
        .slice(0, 3);
    } catch {
      return [];
    }
  })();
  // One area open at a time keeps the sidebar short: the area of the open page, or the one just clicked. Single-page groups have nothing to fold.
  const [expanded, setExpanded] = useState<string | null>(null);
  const openGroup = openSection?.group ?? null;
  useEffect(() => setExpanded(null), [openGroup]);
  const isFolded = (g: string, count: number) => count > 1 && g !== (expanded === '' ? null : (expanded ?? openGroup));
  const toggleGroup = (g: string) => setExpanded((cur) => ((cur ?? openGroup) === g ? '' : g));
  // Byte sleeps at night (the person's own clock; the server's page always draws him awake, so there is no mismatch).
  const asleep = useSyncExternalStore(
    () => () => {},
    () => {
      const h = new Date().getHours();
      return h >= 23 || h < 6;
    },
    () => false,
  );
  const accent = openSection ? GROUP_ACCENT[openSection.group] : DASHBOARD_ACCENT;
  // The frame fills exactly what's left of the window below whatever banners sit above it (profile reminder, "View as"), so
  // the whole frame is on screen without scrolling the page. Re-measured when the window or the page above changes.
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(520, window.innerHeight - top - 12)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);
  return (
    <div ref={frameRef} className={`${styles.desktopShell} ${styles.appFrame}`} data-app-frame style={{ ['--frame-accent' as string]: accent }}>
      <aside
        className={`${styles.rail} ${collapsed ? styles.railCollapsed : ''}`}
        // A mouse click leaves focus on the button, and :focus-within would keep the rail open after the pointer leaves.
        onClickCapture={(e) => {
          if (collapsed && e.detail > 0 && (e.target as HTMLElement).closest('button, a')) (document.activeElement as HTMLElement | null)?.blur?.();
        }}
      >
        <button
          type="button"
          className={`${styles.railLogo} ${!openSection ? styles.railLogoOn : ''}`}
          onClick={close}
          aria-current={!openSection ? 'page' : undefined}
          aria-label="Triton Gaming portal, go to Home"
          title="Home"
        >
          <span className={styles.railLogoByte} aria-hidden="true">
            <ByteMini pose={asleep ? 'sleep' : 'awake'} />
          </span>
          <span className={styles.railLogoText}>
            Triton Gaming
            <small>Member portal</small>
          </span>
        </button>
        <nav className={styles.railNav} aria-label="Portal sections">
          {groupedSections
            .map(({ group, items: all }) => ({ group, items: all.filter((s) => !s.railHidden) }))
            .filter(({ items }) => items.length > 0)
            .map(({ group, items }) => (
              <div
                key={group}
                className={`${styles.railGroup} ${isFolded(group, items.length) ? styles.railGroupFolded : ''}`}
                style={{ ['--accent' as string]: GROUP_ACCENT[group], flexGrow: isFolded(group, items.length) ? 0 : items.length }}
              >
                {groupedSections.length > 1 && group !== 'Overview' && items.length > 1 && (
                  <button
                    type="button"
                    className={`${styles.railGroupLabel} ${styles.railGroupToggle}`}
                    onClick={() => toggleGroup(group)}
                    aria-expanded={!isFolded(group, items.length)}
                    title={isFolded(group, items.length) ? `Show ${GROUP_LABEL[group]}` : `Hide ${GROUP_LABEL[group]}`}
                  >
                    <span className={styles.railGroupPixel} aria-hidden="true">
                      <AreaPixelIcon group={group} />
                    </span>
                    <span className={styles.railGroupText}>
                      {GROUP_LABEL[group]}
                      {/* A closed area names its pages, so nobody has to open it to find out what is inside. */}
                      {isFolded(group, items.length) && <span className={styles.railGroupPeek}>{items.map((x) => x.label).join(' · ')}</span>}
                    </span>
                    <ChevronDown className={styles.railGroupChevron} size={13} aria-hidden="true" />
                  </button>
                )}
                {!isFolded(group, items.length) &&
                  items.map((s) => (
                    <button
                      key={s.id}
                      className={`${styles.railItem} ${s.id === openId ? styles.railItemActive : ''} ${groupedSections.length > 1 && group !== 'Overview' && items.length > 1 ? styles.railItemNested : ''}`}
                      onClick={() => open(s.id)}
                      aria-current={s.id === openId ? 'page' : undefined}
                      title={s.label}
                      aria-label={collapsed ? s.label : undefined}
                    >
                      <span className={styles.railMono} aria-hidden="true">
                        {s.label.charAt(0)}
                      </span>
                      <span className={styles.railLabel}>{s.label}</span>
                      {s.badge !== undefined && s.badge !== 0 && <span className={styles.railBadge}>{s.badge}</span>}
                    </button>
                  ))}
              </div>
            ))}
        </nav>
        {recent.length > 0 && (
          <div className={styles.railRecent}>
            <p className={styles.railRecentLabel}>Recent</p>
            {recent.map((r) => (
              <button key={r.id} type="button" className={styles.railRecentItem} onClick={() => open(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" className={styles.railPin} onClick={toggleCollapsed} aria-pressed={!collapsed} title={collapsed ? 'Pin the menu open' : 'Let the menu hide'}>
          {collapsed ? <Pin size={16} aria-hidden="true" /> : <PinOff size={16} aria-hidden="true" />}
          <span>{collapsed ? 'Pin menu' : 'Unpin menu'}</span>
        </button>
      </aside>

      <div className={styles.frameMain}>
        <header className={styles.topBar}>
          {openSection ? (
            <div className={styles.topTitle}>
              <span className={styles.topTab} aria-hidden="true" />
              <span className={styles.topIcon} aria-hidden="true">
                {smallIcon(openSection.icon, 18)}
              </span>
              <span className={styles.topName}>
                <PortalCrumbs section={openSection.id} sectionLabel={openSection.label} />
              </span>
            </div>
          ) : (
            <div className={styles.topTitle}>
              <span className={styles.topName}>Home</span>
            </div>
          )}
          <div className={styles.topRight}>
            <div className={styles.topCode} title="Enter a code: a meeting check-in, a ticket, a Trivia game or a poll">
              <CodeBox compact />
            </div>
            <div className={styles.topSearch}>
              <PortalSearch compact />
            </div>
            <NotificationBell inline />
            {identity && <AccountMenu identity={identity} viewAs={frame?.viewAs} onProfile={() => open('profile')} />}
          </div>
        </header>
        {frame?.banners && <div className={styles.frameBanners}>{frame.banners}</div>}
        <div className={styles.frameBody} data-save-anchor>
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
                  <div className={styles.panelBody} key={navNonce}>
                    {openSection.content}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="home"
                  className={styles.gridWrap}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.15 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                >
                  {frame?.tiles && <div className={styles.homeTiles}>{frame.tiles}</div>}
                  {homeExtras && <div className={styles.homeExtras}>{homeExtras}</div>}
                  {/* The dashboard's own "Your tools" replaces this list; the sidebar still lists every page. */}
                  {!homeExtras && <HomeGroups groupedSections={groupedSections} open={open} forYou={forYou} />}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
