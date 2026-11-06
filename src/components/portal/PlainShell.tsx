'use client';

import { ReactNode } from 'react';
import Image from 'next/image';
import PortalRefresh from './PortalRefresh';
import PortalSearch from './PortalSearch';
import NotificationBell from './NotificationBell';
import PortalThemeToggle from './PortalThemeToggle';
import MainSiteLink from './MainSiteLink';
import ScanLink from './ScanLink';
import simple from './PortalSimple.module.css';
import { GroupedSection, HubFrame, HubIdentity, HubSection } from './hubTypes';

// The desktop layout for people who are not on the team (guests and UCSD students): one plain top bar with the few pages they have, and the page below it.
// The sidebar app frame is for people with many sections to move between.
export function PlainShell({
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
}: {
  identity?: HubIdentity;
  railFooter?: ReactNode;
  homeExtras?: ReactNode;
  groupedSections: GroupedSection[];
  openSection: HubSection | null;
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
  frame?: HubFrame;
  navNonce: number;
}) {
  const items = groupedSections.flatMap((g) => g.items).filter((s) => !s.railHidden);
  return (
    <div className={simple.shell} data-app-frame>
      <div className={simple.barWrap}>
        <header className={simple.bar}>
          {identity && (
            <button type="button" className={simple.who} onClick={() => open('profile')} aria-label={`${identity.name}, open your profile`}>
              {identity.avatarUrl ? (
                <Image src={identity.avatarUrl} alt="" width={36} height={36} className={simple.avatar} unoptimized referrerPolicy="no-referrer" />
              ) : (
                <span className={simple.avatarFallback} aria-hidden="true">
                  {identity.name[0]?.toUpperCase() ?? 'T'}
                </span>
              )}
              <span className={simple.whoText}>
                <strong>{identity.name}</strong>
                <small>{identity.roleLabel}</small>
              </span>
            </button>
          )}
          <nav className={simple.nav} aria-label="Portal pages">
            <button type="button" className={`${simple.link} ${!openSection ? simple.active : ''}`} onClick={close} aria-current={!openSection ? 'page' : undefined}>
              Home
            </button>
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${simple.link} ${s.id === openId ? simple.active : ''}`}
                onClick={() => open(s.id)}
                aria-current={s.id === openId ? 'page' : undefined}
              >
                {s.label}
                {s.badge !== undefined && s.badge !== 0 && <span className={simple.badge}>{s.badge}</span>}
              </button>
            ))}
          </nav>
          <div className={simple.right}>
            {frame?.viewAs}
            <div className={simple.search}>
              <PortalSearch compact />
            </div>
            <MainSiteLink />
            <ScanLink />
            <PortalRefresh />
            <PortalThemeToggle />
            <NotificationBell inline />
          </div>
        </header>
      </div>
      {frame?.banners && <div className={simple.banners}>{frame.banners}</div>}
      <main className={simple.main} data-save-anchor>
        {openSection ? (
          <div className={simple.page} key={navNonce}>
            {openSection.content}
          </div>
        ) : (
          <div className={`${simple.page} ${simple.home}`}>
            {frame?.tiles && <div className={simple.tiles}>{frame.tiles}</div>}
            {homeExtras}
          </div>
        )}
      </main>
      {railFooter && <footer className={simple.foot}>{railFooter}</footer>}
    </div>
  );
}
