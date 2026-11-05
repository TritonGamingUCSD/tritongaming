'use client';

import { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListTree, Pin, PinOff } from 'lucide-react';
import Spotlight from './Spotlight';
import CodeBox from '@/components/portal/CodeBox';
import NotificationBell from './NotificationBell';
import PortalCrumbs from './PortalCrumbs';
import styles from './PortalHub.module.css';
import ByteMini from '@/components/Bytecode/ByteMini';
import AccountMenu from './AccountMenu';
import SectionTabs from '@/components/ui/SectionTabs';
import { familyOf } from '@/lib/portal/families';
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
  // Every area shows all of its pages, always (the sidebar scrolls if a future list gets longer than the screen).
  const isFolded = () => false;
  // Byte cheers for a couple of seconds when a code worked (CodeBox sends the signal).
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    let t: number | undefined;
    const on = () => {
      setCheer(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setCheer(false), 2600);
    };
    window.addEventListener('tg:checkin-ok', on);
    return () => {
      window.removeEventListener('tg:checkin-ok', on);
      window.clearTimeout(t);
    };
  }, []);
  // Byte sleeps at night (the person's own clock; the server's page always draws him awake, so there is no mismatch).
  const asleep = useSyncExternalStore(
    () => () => {},
    () => {
      const h = new Date().getHours();
      return h >= 23 || h < 6;
    },
    () => false,
  );
  // The white highlight on the open page glides to the next page (placed by measuring the open item, set straight on the element).
  const navRef = useRef<HTMLElement>(null);
  const glideRef = useRef<HTMLSpanElement>(null);
  const activeId = openSection?.id;
  // A yellow line runs under the top bar for a moment when the page changes (one loading signal for every move).
  const [running, setRunning] = useState(false);
  useEffect(() => {
    let t: number | undefined;
    const on = () => {
      setRunning(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setRunning(false), 900);
    };
    window.addEventListener('tg:nav-start', on);
    return () => {
      window.removeEventListener('tg:nav-start', on);
      window.clearTimeout(t);
    };
  }, []);
  useEffect(() => {
    window.dispatchEvent(new Event('tg:nav-start'));
  }, [activeId]);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const g = glideRef.current;
    if (!nav || !g) return;
    const el = nav.querySelector<HTMLElement>('[data-rail-active]');
    if (!el) {
      g.style.opacity = '0';
      return;
    }
    g.style.opacity = '1';
    g.style.width = `${el.offsetWidth}px`;
    g.style.height = `${el.offsetHeight}px`;
    g.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
  }, [activeId, groupedSections]);
  // Pages that belong together are one entry in the list (People, Live Tools, Standing, Events): the entry opens the first page of its family, and the family's pages are the tabs under the top bar.
  const allRail = groupedSections.flatMap((g) => g.items).filter((x) => !x.railHidden);
  const kidsOf = (fid: string | undefined, sid: string) => {
    const f = familyOf(sid);
    return f && f.id === fid ? f.children.filter((c) => allRail.some((x) => x.id === c.id)) : [];
  };
  const collapseFamilies = (list: HubSection[]) => {
    const seen = new Set<string>();
    const out: HubSection[] = [];
    for (const s of list) {
      const f = familyOf(s.id);
      const kids = f ? f.children.filter((c) => allRail.some((x) => x.id === c.id)) : [];
      if (!f || kids.length < 2) {
        out.push(s);
        continue;
      }
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const first = allRail.find((x) => x.id === kids[0].id) ?? s;
      out.push({ ...first, label: f.label, badge: undefined });
    }
    return out;
  };
  const isOpen = (s: HubSection) =>
    s.id === openId ||
    (!!openId && familyOf(openId) !== undefined && familyOf(openId) === familyOf(s.id) && kidsOf(familyOf(s.id)?.id, s.id).length >= 2 && s.label === familyOf(s.id)?.label);
  // The pages inside a group entry, named in small text under it so nothing has to be opened to find out what is in there.
  const peekOf = (s: HubSection) => {
    const f = familyOf(s.id);
    if (!f || f.peek === false || s.label !== f.label) return null;
    const kids = f.children.filter((c) => allRail.some((x) => x.id === c.id));
    return kids.length >= 2 ? kids.map((k) => k.label).join(' · ') : null;
  };
  const openFamily = openSection ? familyOf(openSection.id) : undefined;
  const openKids = openFamily && openSection ? kidsOf(openFamily.id, openSection.id) : [];
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
            <ByteMini pose={cheer ? 'happy' : asleep ? 'sleep' : 'awake'} />
          </span>
          <span className={styles.railLogoText}>
            Triton Gaming
            <small>Member portal</small>
          </span>
        </button>
        <nav ref={navRef} className={styles.railNav} aria-label="Portal sections">
          <span ref={glideRef} className={styles.railGlide} aria-hidden="true" />
          {groupedSections
            .map(({ group, items: all }) => ({ group, items: collapseFamilies(all.filter((s) => !s.railHidden)) }))
            .filter(({ items }) => items.length > 0)
            .map(({ group, items }) => (
              <div
                key={group}
                className={`${styles.railGroup} ${isFolded() ? styles.railGroupFolded : ''}`}
                style={{ ['--accent' as string]: GROUP_ACCENT[group], flexGrow: isFolded() ? 0 : items.length }}
              >
                {groupedSections.length > 1 && group !== 'Overview' && items.length > 1 && (
                  <div className={styles.railGroupLabel}>
                    <span className={styles.railGroupPixel} aria-hidden="true">
                      <AreaPixelIcon group={group} />
                    </span>
                    <span className={styles.railGroupText}>{GROUP_LABEL[group]}</span>
                  </div>
                )}
                {!isFolded() &&
                  items.map((s) => (
                    <button
                      key={s.id}
                      data-rail-active={isOpen(s) ? '' : undefined}
                      className={`${styles.railItem} ${isOpen(s) ? styles.railItemActive : ''} ${groupedSections.length > 1 && group !== 'Overview' && items.length > 1 ? styles.railItemNested : ''}`}
                      onClick={() => open(s.id)}
                      aria-current={isOpen(s) ? 'page' : undefined}
                      title={s.label}
                      aria-label={collapsed ? s.label : undefined}
                    >
                      {items.length === 1 && group !== 'Overview' && group !== 'Admin' ? (
                        <span className={styles.railGroupPixel} aria-hidden="true">
                          <AreaPixelIcon group={group} />
                        </span>
                      ) : (
                        <span className={styles.railMono} aria-hidden="true">
                          {s.label.charAt(0)}
                        </span>
                      )}
                      <span className={styles.railLabel}>
                        {s.label}
                        {peekOf(s) && <small className={styles.railPeekLine}>{peekOf(s)}</small>}
                      </span>
                      {s.badge !== undefined && s.badge !== 0 && <span className={styles.railBadge}>{s.badge}</span>}
                    </button>
                  ))}
              </div>
            ))}
        </nav>
        {groupedSections.some((g) => g.items.some((s) => s.id === 'all')) && (
          <button type="button" className={`${styles.railPin} ${styles.railAll}`} onClick={() => open('all')} aria-current={openId === 'all' ? 'page' : undefined}>
            <ListTree size={16} aria-hidden="true" />
            <span>All Functions</span>
          </button>
        )}
        <button type="button" className={styles.railPin} onClick={toggleCollapsed} aria-pressed={!collapsed} title={collapsed ? 'Pin the menu open' : 'Let the menu hide'}>
          {collapsed ? <Pin size={16} aria-hidden="true" /> : <PinOff size={16} aria-hidden="true" />}
          <span>{collapsed ? 'Pin menu' : 'Unpin menu'}</span>
        </button>
      </aside>

      <div className={styles.frameMain}>
        <header className={styles.topBar}>
          {collapsed && (
            <button type="button" className={styles.topToggle} onClick={toggleCollapsed} aria-label="Show the menu" title="Show the menu (pin it open)">
              Menu
            </button>
          )}
          {openSection ? (
            <div className={styles.topTitle}>
              <span className={styles.topTab} aria-hidden="true" />

              {GROUP_LABEL[openSection.group] !== openSection.label && (
                <span className={styles.topArea}>
                  {GROUP_LABEL[openSection.group]}
                  <span aria-hidden="true"> / </span>
                </span>
              )}
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
            <Spotlight />
            <NotificationBell inline />
            {identity && <AccountMenu identity={identity} viewAs={frame?.viewAs} onProfile={() => open('profile')} />}
          </div>
        </header>
        <div className={styles.navLine} data-running={running ? '' : undefined} aria-hidden="true" />
        <div className={styles.tabStrip} data-top-tabs data-family={openKids.length >= 2 ? '' : undefined}>
          {openKids.length >= 2 && openSection && (
            <SectionTabs value={openSection.id} onChange={(id) => open(id)} label={openFamily?.label ?? 'Pages'} tabs={openKids.map((k) => ({ id: k.id, label: k.label }))} />
          )}
        </div>
        {frame?.banners && <div className={styles.frameBanners}>{frame.banners}</div>}
        <div
          className={styles.frameBody}
          data-save-anchor
          onScroll={(e) => {
            frameRef.current?.toggleAttribute('data-scrolled', e.currentTarget.scrollTop > 4);
          }}
        >
          <div className={styles.desktopContent}>
            <AnimatePresence mode="wait" initial={false}>
              {openSection ? (
                <motion.div
                  key={openSection.id}
                  className={styles.desktopPanel}
                  initial={{ opacity: 0, y: 6, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.22 } }}
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
                  initial={{ opacity: 0, y: 6, filter: 'blur(5px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.22 } }}
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
