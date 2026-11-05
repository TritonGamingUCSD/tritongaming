'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from '@/components/portal/PortalLink';
import { Monitor, Moon, Sun } from 'lucide-react';
import { getThemeChoice, setThemeChoice, type ThemeChoice } from '@/lib/portal/themeScript';
import SignOutButton from './SignOutButton';
import type { HubIdentity } from './hubTypes';
import styles from './AccountMenu.module.css';

// The picture in the top bar and what opens from it, in plain groups: who you are (picture, level, points, roles), a few quick settings, admin tools, then where to go (profile, help, the public site) and Sign out apart at the bottom.
export default function AccountMenu({ identity, viewAs, onProfile }: { identity: HubIdentity; viewAs?: ReactNode; onProfile: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThemeChoice>('system');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMode(getThemeChoice());
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const letter = identity.name[0]?.toUpperCase() ?? 'T';
  const avatar = (px: number) =>
    identity.avatarUrl ? (
      <Image src={identity.avatarUrl} alt="" width={px} height={px} className={styles.avatar} unoptimized referrerPolicy="no-referrer" />
    ) : (
      <span className={styles.avatar}>{letter}</span>
    );
  const waiting = identity.help?.waiting ?? 0;
  return (
    <div className={styles.wrap} ref={box}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account menu"
        title={identity.name}
      >
        <span className={styles.ring} style={{ ['--xp' as string]: `${identity.progress ?? 0}%` }}>
          {avatar(32)}
        </span>
        {waiting > 0 && <span className={styles.dot} aria-label={`${waiting} waiting in help`} />}
      </button>
      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.card}>
            <span className={`${styles.ring} ${styles.ringBig}`} style={{ ['--xp' as string]: `${identity.progress ?? 0}%` }}>
              {avatar(56)}
            </span>
            <div className={styles.who}>
              <p className={styles.name}>{identity.name}</p>
              {identity.roles && identity.roles.length > 0 && (
                <div className={styles.roles}>
                  {identity.roles.map((r) => (
                    <span
                      key={r.label}
                      className={styles.role}
                      style={{ color: `color-mix(in srgb, ${r.color} 30%, #fff)`, background: `${r.color}33`, borderColor: `${r.color}99` }}
                    >
                      {r.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {identity.level && (
              <div className={styles.stats}>
                <span className={styles.levelPill}>{identity.level}</span>
                {identity.points !== undefined && <span className={styles.points}>{identity.points.toLocaleString()} points</span>}
                {identity.progress !== undefined && identity.toNext && (
                  <>
                    <span className={styles.xp}>
                      <span style={{ width: `${identity.progress}%` }} />
                    </span>
                    <span className={styles.toNext}>{identity.toNext}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <p className={styles.label}>Appearance</p>
            <div className={styles.modes} role="group" aria-label="Appearance" style={{ ['--i' as string]: ['light', 'system', 'dark'].indexOf(mode) }}>
              <span className={styles.bubble} aria-hidden="true" />
              {(
                [
                  ['light', 'Light', 'Always light', Sun],
                  ['system', 'Auto', 'Match this device', Monitor],
                  ['dark', 'Dark', 'Always dark', Moon],
                ] as const
              ).map(([id, text, hint, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.mode} ${mode === id ? styles.modeOn : ''}`}
                  aria-pressed={mode === id}
                  aria-label={`${text}: ${hint}`}
                  title={`${text}: ${hint}`}
                  onClick={() => {
                    setMode(id);
                    setThemeChoice(id);
                  }}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              ))}
            </div>
            {viewAs && (
              <>
                <p className={styles.label}>View the portal as</p>
                <div className={styles.viewAs}>{viewAs}</div>
              </>
            )}
          </div>

          <div className={styles.links}>
            <button
              type="button"
              className={styles.row}
              onClick={() => {
                setOpen(false);
                onProfile();
              }}
            >
              <span>Your profile</span>
              <span className={styles.go}>→</span>
            </button>
            <Link href="/portal/profile/notifications" className={styles.row} onClick={() => setOpen(false)}>
              <span>Notifications</span>
              <span className={styles.go}>→</span>
            </Link>
            {identity.help && (
              <Link href="/portal/help" className={styles.row} onClick={() => setOpen(false)}>
                <span>{identity.help.label}</span>
                {waiting > 0 ? <span className={styles.badge}>{waiting}</span> : <span className={styles.go}>→</span>}
              </Link>
            )}
            <Link href="/" className={styles.row} onClick={() => setOpen(false)}>
              <span>Back to the website</span>
              <span className={styles.go}>→</span>
            </Link>
          </div>
          <SignOutButton plain className={styles.signOut} />
        </div>
      )}
    </div>
  );
}
