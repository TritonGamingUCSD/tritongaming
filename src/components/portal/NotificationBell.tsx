'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import type { Notification } from '@/types/database';
import styles from './NotificationBell.module.css';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Older notifications were stored with page-style links ("/portal/tickets") that don't exist as pages;
// the portal is one page with sections, so turn them into "/portal?section=…". Role changes land on
// the profile, where the roles are shown.
function resolveHref(n: Pick<Notification, 'href' | 'type'>): string | null {
  const h = n.href;
  if (!h) return null;
  const m = /^\/portal\/([a-z-]+)\/?$/.exec(h);
  if (m) return `/portal?section=${m[1]}`;
  return h;
}

// Fixed to the viewport corner rather than slotted into the page flow —
// PortalTopbar (the other persistent portal chrome) hides itself on
// /portal specifically, and the bell needs to stay reachable everywhere,
// including there.
export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent — the bell just keeps showing its last known state until
      // the next successful poll.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    // Light polling instead of a realtime subscription — a notification
    // arriving a few seconds late is a non-issue for this content (unlike
    // FullscreenQR's live check-in status), so this avoids introducing a
    // second realtime-channel pattern into the codebase for one bell icon.
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  }

  function markAllRead() {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    setUnreadCount(0);
    fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={17} strokeWidth={1.5} aria-hidden="true" />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span className={styles.title}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllBtn} onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {!loaded ? (
            <div className={styles.statusLoading}><LoadingSpinner size={22} label="Loading notifications…" theme="dark" /></div>
          ) : notifications.length === 0 ? (
            <div className={styles.status}>
              <Image src="/bytes/byte_tgex25.png" alt="" width={44} height={44} aria-hidden="true" />
              You're all caught up.
            </div>
          ) : (
            <ul className={styles.list}>
              {notifications.map((n) => {
                const isUnread = !n.read_at;
                const body = (
                  <>
                    <div className={styles.itemTop}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {isUnread && <span className={styles.unreadDot} aria-hidden="true" />}
                    </div>
                    {n.body && <p className={styles.itemBody}>{n.body}</p>}
                    <span className={styles.itemTime}>{timeAgo(n.created_at)}</span>
                  </>
                );
                return (
                  <li key={n.id} className={styles.item}>
                    {resolveHref(n) ? (
                      <Link
                        href={resolveHref(n)!}
                        className={styles.itemLink}
                        onClick={() => { if (isUnread) markRead(n.id); setOpen(false); window.dispatchEvent(new Event('tg:portal-nav')); }}
                      >
                        {body}
                      </Link>
                    ) : (
                      <button type="button" className={styles.itemLink} onClick={() => isUnread && markRead(n.id)}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
