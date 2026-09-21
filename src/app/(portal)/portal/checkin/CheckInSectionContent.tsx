'use client';

import { useState } from 'react';
import { Camera, Gift, Wifi, Undo2 } from 'lucide-react';
import { usePortalTabSync } from '@/lib/usePortalTabSync';
import CheckInClient from './CheckInClient';
import RedemptionScanner from './RedemptionScanner';
import OnlineCheckinPanel from './OnlineCheckinPanel';
import styles from './checkinsection.module.css';

interface Event { id: string; title: string; start_date: string; is_online: boolean; }

type Tab = 'tickets' | 'redemptions' | 'online';
const VALID_TABS: Tab[] = ['tickets', 'redemptions', 'online'];

interface RecentCheckin { ticketId: string; userName: string; }

// Wraps the existing (working, camera-handling, fairly involved)
// CheckInClient with two new sibling tools rather than touching it
// directly — same officer audience, same events list, but genuinely
// different jobs (scanning a ticket vs. a redemption QR vs. revealing an
// online check-in code), so a tab bar keeps them from competing for the
// same screen instead of merging into one increasingly-overloaded
// component.
export default function CheckInSectionContent({ events, canScanRedemptions, canManagePoints, initialTab }: { events: Event[]; canScanRedemptions: boolean; canManagePoints: boolean; initialTab?: string }) {
  const [tab, setTab] = useState<Tab>(VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : 'tickets');
  const syncUrl = usePortalTabSync('checkin');
  function selectTab(t: Tab) {
    setTab(t);
    syncUrl(t);
  }
  const [recentCheckins, setRecentCheckins] = useState<RecentCheckin[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  // Only events actually marked online get the code-reveal panel — an
  // in-person event has no one who'd ever need a code, and showing the tab
  // anyway would just invite an officer to reveal a code nobody's meant to
  // use.
  const onlineEvents = events.filter((e) => e.is_online);

  function handleCheckedIn(entry: RecentCheckin) {
    setRecentCheckins((prev) => [entry, ...prev.filter((r) => r.ticketId !== entry.ticketId)].slice(0, 5));
  }

  async function handleUndoCheckin(ticketId: string) {
    if (!window.confirm('Undo this check-in and reverse the points?')) return;
    setUndoingId(ticketId);
    try {
      const res = await fetch('/api/checkin/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      if (res.ok) setRecentCheckins((prev) => prev.filter((r) => r.ticketId !== ticketId));
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabBar} role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'tickets'} className={`${styles.tab} ${tab === 'tickets' ? styles.tabActive : ''}`} onClick={() => selectTab('tickets')}>
          <Camera size={13} strokeWidth={1.5} aria-hidden="true" /> Tickets
        </button>
        {canScanRedemptions && (
          <button type="button" role="tab" aria-selected={tab === 'redemptions'} className={`${styles.tab} ${tab === 'redemptions' ? styles.tabActive : ''}`} onClick={() => selectTab('redemptions')}>
            <Gift size={13} strokeWidth={1.5} aria-hidden="true" /> Redemptions
          </button>
        )}
        {onlineEvents.length > 0 && (
          <button type="button" role="tab" aria-selected={tab === 'online'} className={`${styles.tab} ${tab === 'online' ? styles.tabActive : ''}`} onClick={() => selectTab('online')}>
            <Wifi size={13} strokeWidth={1.5} aria-hidden="true" /> Online Check-In
          </button>
        )}
      </div>

      {tab === 'tickets' && (
        <>
          <CheckInClient events={events} onCheckedIn={handleCheckedIn} />
          {canManagePoints && recentCheckins.length > 0 && (
            <div className={styles.recentSection}>
              <h2 className={styles.recentLabel}>Just Checked In</h2>
              {recentCheckins.map((r) => (
                <div key={r.ticketId} className={styles.recentRow}>
                  <span>{r.userName}</span>
                  <button type="button" className={styles.undoBtn} onClick={() => handleUndoCheckin(r.ticketId)} disabled={undoingId === r.ticketId}>
                    <Undo2 size={13} strokeWidth={1.75} aria-hidden="true" /> {undoingId === r.ticketId ? 'Undoing…' : 'Undo'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'redemptions' && canScanRedemptions && <RedemptionScanner canManagePoints={canManagePoints} />}
      {tab === 'online' && onlineEvents.length > 0 && <OnlineCheckinPanel events={onlineEvents} />}
    </div>
  );
}
