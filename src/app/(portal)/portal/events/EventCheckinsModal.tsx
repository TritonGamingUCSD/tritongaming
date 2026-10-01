'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import UndoCheckinModal from '@/components/UndoCheckinModal/UndoCheckinModal';
import { X, Camera, Gamepad2, Undo2, Download, Check } from 'lucide-react';
import { resolveAvatarUrl } from '@/lib/profile';
import { PACIFIC_TZ } from '@/lib/timezone';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import checkinStyles from './[id]/checkins/checkins.module.css';
import styles from './eventcheckinsmodal.module.css';

interface TicketUser {
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  gamer_tag: string | null;
}

interface TicketRow {
  id: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  created_at: string;
  checked_in_at: string | null;
  // Honor-system only — the attendee's own "I've Completed This Form"
  // confirmation, not proof of an actual Google Forms submission (see
  // checkin_form_completed_at migration). This column exists so staff have
  // *some* visibility to physically double-check at the door, since the
  // app itself can't verify a real submission.
  checkin_form_completed_at: string | null;
  user: TicketUser | TicketUser[] | null;
}

interface EventInfo {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  requires_checkin_form: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Registered', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

// Opened from a click in the Event Management list (see
// EventsSectionContent.tsx) instead of navigating to the standalone
// /portal/events/[id]/checkins page — checking who's registered for an
// event shouldn't cost you your place in whatever list/filter/scroll
// position you were at in the hub. The standalone page still exists as a
// direct-link fallback, same pattern as /portal/admin/content next to the
// hub's own Site Content card.
export default function EventCheckinsModal({ eventId, onClose, canManagePoints }: { eventId: string; onClose: () => void; canManagePoints: boolean }) {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState('');
  const [uncheckingId, setUncheckingId] = useState<string | null>(null);
  // Which ticket's undo-confirm (hold-to-confirm) modal is open.
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  async function handleManualCheckIn(ticketId: string) {
    setCheckingInId(ticketId);
    setError('');
    try {
      const res = await fetch('/api/checkin/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to check in.'); return; }
      setTickets((prev) => prev?.map((t) => (t.id === ticketId ? { ...t, status: 'used', checked_in_at: new Date().toISOString() } : t)) ?? null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCheckingInId(null);
    }
  }

  async function handleUncheckIn(ticketId: string) {
    setUncheckingId(ticketId);
    try {
      const res = await fetch('/api/checkin/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to undo check-in.'); return; }
      setTickets((prev) => prev?.map((t) => (t.id === ticketId ? { ...t, status: 'active', checked_in_at: null, checkin_form_completed_at: null } : t)) ?? null);
      setUndoTargetId(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUncheckingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/checkins`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load check-ins.');
          return;
        }
        setEvent(json.event);
        setTickets(json.tickets);
      } catch {
        if (!cancelled) setError('Network error loading check-ins.');
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const activeTickets = (tickets ?? []).filter((t) => t.status !== 'cancelled');
  const checkedInCount = (tickets ?? []).filter((t) => t.status === 'used').length;
  const attendanceRate = activeTickets.length > 0 ? Math.round((checkedInCount / activeTickets.length) * 100) : 0;

  // Base 4 columns (see checkins.module.css) plus whichever optional ones
  // actually apply — AS Form only for events that have it on, Actions only
  // for whoever can manage points/undo a check-in.
  const gridTemplateColumns = [
    '2fr', '1fr', 'minmax(120px, 1fr)', '1fr',
    ...(event?.requires_checkin_form ? ['90px'] : []),
    ...(canManagePoints ? ['90px'] : []),
  ].join(' ');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close check-ins">
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>

        {error ? (
          <p className={styles.error}>{error}</p>
        ) : !event || !tickets ? (
          <LoadingSpinner size={28} label="Loading check-ins…" theme="dark" />
        ) : (
          <>
            <div className={checkinStyles.header} style={{ marginBottom: '1.5rem' }}>
              <h1 className={checkinStyles.title}>{event.title}</h1>
              <p className={checkinStyles.sub}>
                {new Date(event.start_date).toLocaleDateString('en-US', {
                  timeZone: PACIFIC_TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
                {event.location && ` · ${event.location}`}
              </p>
            </div>

            <div className={checkinStyles.statsRow}>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{activeTickets.length}</div>
                <div className={checkinStyles.statLabel}>Registered</div>
              </div>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{checkedInCount}</div>
                <div className={checkinStyles.statLabel}>Checked In</div>
              </div>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{attendanceRate}%</div>
                <div className={checkinStyles.statLabel}>Attendance</div>
              </div>
              <Link href="/portal?section=checkin" className={checkinStyles.scanBtn}>
                <Camera size={16} strokeWidth={1.5} aria-hidden="true" /> Open Scanner
              </Link>
              <a href={`/api/events/${eventId}/export`} download className={checkinStyles.exportBtn}>
                <Download size={15} strokeWidth={1.5} aria-hidden="true" /> Export CSV
              </a>
            </div>

            {tickets.length === 0 ? (
              <div className={checkinStyles.empty}>No one has registered for this event yet.</div>
            ) : (
              <div className={checkinStyles.table}>
                <div className={checkinStyles.tableHeader} style={{ gridTemplateColumns }}>
                  <span>Attendee</span>
                  <span>Registered</span>
                  <span>Status</span>
                  <span>Checked In</span>
                  {event.requires_checkin_form && <span>AS Form</span>}
                  {canManagePoints && <span></span>}
                </div>
                {tickets.map((t) => {
                  const user = Array.isArray(t.user) ? t.user[0] : t.user;
                  const avatarUrl = user ? resolveAvatarUrl(user) : null;
                  return (
                    <div key={t.id} className={checkinStyles.tableRow} style={{ gridTemplateColumns }}>
                      <div className={checkinStyles.attendee}>
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" width={32} height={32} className={checkinStyles.avatar} unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <div className={checkinStyles.avatarFallback}>{(user?.display_name || '?')[0].toUpperCase()}</div>
                        )}
                        <div>
                          <div className={checkinStyles.name}>{user?.display_name || 'Anonymous'}</div>
                          {user?.gamer_tag && <div className={checkinStyles.gamerTag}><Gamepad2 size={12} strokeWidth={1.5} aria-hidden="true" /> {user.gamer_tag}</div>}
                        </div>
                      </div>
                      <span className={checkinStyles.date}>
                        {new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`${checkinStyles.badge} ${checkinStyles[`status_${t.status}`]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className={checkinStyles.date}>
                        {t.checked_in_at
                          ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
                          : '—'}
                      </span>
                      {event.requires_checkin_form && (
                        <span>
                          {t.status !== 'used' ? (
                            <span className={styles.formDash}>—</span>
                          ) : t.checkin_form_completed_at ? (
                            <span className={styles.formDone}><Check size={12} strokeWidth={2} aria-hidden="true" /> Opened</span>
                          ) : (
                            <span className={styles.formPending}>Not opened</span>
                          )}
                        </span>
                      )}
                      {canManagePoints && (
                        <span>
                          {t.status === 'used' ? (
                            <button
                              type="button"
                              className={styles.uncheckBtn}
                              onClick={() => setUndoTargetId(t.id)}
                              disabled={uncheckingId === t.id}
                            >
                              <Undo2 size={12} strokeWidth={1.75} aria-hidden="true" /> {uncheckingId === t.id ? '…' : 'Undo'}
                            </button>
                          ) : t.status === 'active' ? (
                            <button
                              type="button"
                              className={styles.checkInBtn}
                              onClick={() => handleManualCheckIn(t.id)}
                              disabled={checkingInId === t.id}
                              title="Check in without scanning a QR code or online code"
                            >
                              <Check size={12} strokeWidth={2} aria-hidden="true" /> {checkingInId === t.id ? '…' : 'Check In'}
                            </button>
                          ) : null}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {undoTargetId && (
        <UndoCheckinModal
          name={(() => { const u = tickets?.find((t) => t.id === undoTargetId)?.user; return (Array.isArray(u) ? u[0] : u)?.display_name ?? undefined; })()}
          busy={uncheckingId === undoTargetId}
          onConfirm={() => handleUncheckIn(undoTargetId)}
          onCancel={() => setUndoTargetId(null)}
        />
      )}
    </div>
  );
}
