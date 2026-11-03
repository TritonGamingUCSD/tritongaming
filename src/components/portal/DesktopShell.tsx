'use client';

import { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import PortalRefresh from './PortalRefresh';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Hash, Home } from 'lucide-react';
import CodeBox from '@/components/portal/CodeBox';
import PortalSearch from './PortalSearch';
import NotificationBell from './NotificationBell';
import PortalThemeToggle from './PortalThemeToggle';
import PortalCopyLink from './PortalCopyLink';
import ScanLink from './ScanLink';
import CodeButton from './CodeButton';
import PortalCrumbs from './PortalCrumbs';
import styles from './PortalHub.module.css';
import { smallIcon } from './smallIcon';
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
  railFooter,
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
  railFooter?: ReactNode;
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
  // Groups can be folded away to leave a shorter sidebar: remembered per browser; the group of the page that is open always shows.
  const [folded, setFolded] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tg_rail_groups') ?? '[]');
      if (Array.isArray(saved)) setFolded(saved.filter((x): x is string => typeof x === 'string'));
    } catch {
      /* ignore */
    }
  }, []);
  const toggleGroup = (g: string) =>
    setFolded((list) => {
      const next = list.includes(g) ? list.filter((x) => x !== g) : [...list, g];
      try {
        localStorage.setItem('tg_rail_groups', JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
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
        {identity && (
          <button
            type="button"
            className={styles.railIdentity}
            onClick={() => open('profile')}
            aria-label={`${identity.name}${identity.roles?.length ? ` ${identity.roles.map((r) => r.label).join(' ')}` : ''}, open your profile`}
            title="Your profile"
          >
            {identity.avatarUrl ? (
              <Image src={identity.avatarUrl} alt="" width={40} height={40} className={styles.railAvatar} unoptimized referrerPolicy="no-referrer" />
            ) : (
              <span className={styles.railAvatarFallback} aria-hidden="true" data-letter={identity.name[0]?.toUpperCase() ?? 'T'} />
            )}
            <span className={styles.railIdentityText}>
              <span className={styles.railName}>{identity.name}</span>{' '}
              {identity.roles && identity.roles.length > 0 ? (
                <span className={styles.railRoles}>
                  {identity.roles.map((r) => (
                    <span
                      key={r.label}
                      className={styles.railRoleChip}
                      style={{ color: `color-mix(in srgb, ${r.color} 30%, var(--pp-chrome-fg))`, background: `${r.color}26`, borderColor: `${r.color}66` }}
                    >
                      {r.label}
                    </span>
                  ))}
                </span>
              ) : (
                <span className={styles.railRole}>{identity.roleLabel}</span>
              )}
            </span>
          </button>
        )}
        {/* the code box: a meeting's, a ticket's, a Trivia game's or a poll's code can be typed on any page */}
        <div className={styles.railCode} title="Enter a code: a meeting check-in, a ticket, a Trivia game or a poll">
          <span className={styles.railCodeIcon} aria-hidden="true">
            <Hash />
          </span>
          <div className={styles.railCodeBox}>
            <CodeBox compact />
          </div>
        </div>
        <nav className={styles.railNav} aria-label="Portal sections">
          <button
            className={`${styles.railItem} ${!openSection ? styles.railItemActive : ''}`}
            style={{ ['--accent' as string]: DASHBOARD_ACCENT }}
            onClick={close}
            aria-current={!openSection ? 'page' : undefined}
            title="Dashboard"
          >
            <span className={styles.railIcon} aria-hidden="true">
              <Home />
            </span>
            <span className={styles.railLabel}>Dashboard</span>
          </button>
          {groupedSections
            .map(({ group, items: all }) => ({ group, items: all.filter((s) => !s.railHidden) }))
            .filter(({ items }) => items.length > 0)
            .map(({ group, items }) => (
              <div
                key={group}
                className={`${styles.railGroup} ${folded.includes(group) && !items.some((x) => x.id === openId) ? styles.railGroupFolded : ''}`}
                style={{ ['--accent' as string]: GROUP_ACCENT[group], flexGrow: folded.includes(group) && !items.some((x) => x.id === openId) ? 0 : items.length }}
              >
                {groupedSections.length > 1 && group !== 'Overview' && (
                  <button
                    type="button"
                    className={`${styles.railGroupLabel} ${styles.railGroupToggle}`}
                    onClick={() => toggleGroup(group)}
                    aria-expanded={!folded.includes(group) || items.some((x) => x.id === openId)}
                    title={folded.includes(group) ? `Show ${GROUP_LABEL[group]}` : `Hide ${GROUP_LABEL[group]}`}
                  >
                    <span className={styles.railGroupDot} aria-hidden="true" />
                    {GROUP_LABEL[group]}
                    <ChevronDown className={styles.railGroupChevron} size={13} aria-hidden="true" />
                  </button>
                )}
                {(!folded.includes(group) || items.some((x) => x.id === openId)) &&
                  items.map((s) => (
                    <button
                      key={s.id}
                      className={`${styles.railItem} ${s.id === openId ? styles.railItemActive : ''}`}
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
        {railFooter && <div className={styles.railFooter}>{railFooter}</div>}
      </aside>

      <div className={styles.frameMain}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.topToggle}
            onClick={toggleCollapsed}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Show menu' : 'Hide menu'}
            title={collapsed ? 'Show menu' : 'Hide menu'}
          >
            {collapsed ? 'Menu' : 'Hide menu'}
          </button>
          {openSection ? (
            <div className={styles.topTitle}>
              <span className={styles.topIcon} aria-hidden="true">
                {smallIcon(openSection.icon, 18)}
              </span>
              <span className={styles.topName}>
                <PortalCrumbs section={openSection.id} sectionLabel={openSection.label} />
              </span>
            </div>
          ) : (
            <div className={styles.topTitle}>
              <span className={styles.topName}>{frame?.greeting ?? 'Dashboard'}</span>
            </div>
          )}
          <div className={styles.topRight}>
            {frame?.viewAs}
            <div className={styles.topSearch}>
              <PortalSearch compact />
            </div>
            {collapsed && <CodeButton />}
            <ScanLink />
            <PortalCopyLink />
            <PortalRefresh />
            <PortalThemeToggle />
            <NotificationBell inline />
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
