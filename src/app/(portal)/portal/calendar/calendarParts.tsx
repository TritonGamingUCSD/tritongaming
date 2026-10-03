'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, CircleDashed, MapPin, Radio, Repeat, Ticket, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { formatEventTimeRange } from '@/lib/timezone';
import { googleCalendarUrl } from '@/lib/ics';
import styles from './calendar.module.css';

export interface Item {
  key: string; kind: 'event' | 'meeting' | 'internal'; date: string; title: string; start: string; end: string | null;
  location: string | null; href: string; mine: boolean; dayLabel: string | null; repeats?: boolean;
  status?: 'ticket' | 'checked_in' | 'hosting' | 'going' | 'maybe'; description?: string | null;
}

const TZ = 'America/Los_Angeles';
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
export const kindClass = (k: Item['kind']) => (k === 'event' ? styles.kEvent : k === 'internal' ? styles.kInternal : styles.kMeeting);
export const kindLabel = (i: Item) => (i.kind === 'event' ? 'Event' : i.kind === 'internal' ? 'Internal event' : 'Meeting');
export const whenLabel = (i: Item) => (i.kind === 'event' ? formatEventTimeRange(i.start, i.end) : `${timeOf(i.start)}${i.end ? ` – ${timeOf(i.end)}` : ''}`);

// My own standing on an item, in the same colors everywhere: gold ticket, green checked in / hosting / going, amber maybe.
const STATUS = {
  ticket:     { label: 'Ticket', icon: Ticket, cls: 'stTicket' },
  checked_in: { label: 'Checked in', icon: Check, cls: 'stGo' },
  hosting:    { label: 'Hosting', icon: Radio, cls: 'stGo' },
  going:      { label: 'Going', icon: Check, cls: 'stGo' },
  maybe:      { label: 'Maybe', icon: CircleDashed, cls: 'stMaybe' },
} as const;
export function StatusBadge({ status, compact }: { status?: Item['status']; compact?: boolean }) {
  if (!status) return null;
  const s = STATUS[status]; const Icon = s.icon;
  return <span className={`${styles.status} ${styles[s.cls]}`} title={s.label}><Icon size={compact ? 10 : 11} aria-hidden="true" />{!compact && s.label}{compact && <span className={styles.srOnly}>{s.label}</span>}</span>;
}

// Click an item and a small card opens beside it, with what you need and a way to add it to your own calendar, without leaving the page.
export function ItemPopup({ item, anchor, onClose }: { item: Item; anchor: DOMRect; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let left = anchor.right + 10; if (left + w > vw - 12) left = Math.max(12, anchor.left - w - 10);
    if (left < 12) left = Math.min(Math.max(12, anchor.left), vw - w - 12);
    const top = Math.min(Math.max(12, anchor.top), vh - h - 12);
    setPos({ left, top });
  }, [anchor]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('keydown', key); document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, [onClose]);
  return (
    <div ref={ref} className={`${styles.popup} ${kindClass(item.kind)}`} style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }} role="dialog" aria-label={item.title}>
      <button type="button" className={styles.popupClose} onClick={onClose} aria-label="Close"><X size={14} aria-hidden="true" /></button>
      <span className={styles.popupKind}><i className={styles.popupDot} /> {kindLabel(item)}{item.repeats && <Repeat size={11} aria-label="Repeats weekly" />}</span>
      <h3 className={styles.popupTitle}>{item.title}</h3>
      <p className={styles.popupMeta}>{whenLabel(item)}{item.dayLabel ? ` · ${item.dayLabel}` : ''}</p>
      {item.location && <p className={styles.popupMeta}><MapPin size={12} aria-hidden="true" /> {item.location}</p>}
      {item.status && <StatusBadge status={item.status} />}
      <div className={styles.popupActions}>
        <Link href={item.href} className={styles.popupOpen} onClick={onClose}>Open</Link>
        <Button size="sm" variant="secondary" onClick={() => window.open(googleCalendarUrl({ title: item.title, start: item.start, end: item.end, location: item.location, details: item.description ?? null }), '_blank', 'noopener,noreferrer')}>Add to Google Calendar</Button>
      </div>
    </div>
  );
}
