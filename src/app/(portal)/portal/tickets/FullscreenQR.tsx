'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS, eventLabelIcon, type QRCodeOptions } from '@/lib/qrCodeStyling';
import styles from './fullscreenqr.module.css';

// Same TG-branded look as the portal's QR Studio "default" preset (see
// src/lib/qrCodeStyling.ts), but the center icon is swapped for the event's
// own text (see eventLabelIcon) instead of the TG logo — so it's obvious at
// a glance which event this ticket is for, not just encoded in the data.
const TICKET_QR_BASE: Omit<QRCodeOptions, 'data' | 'icon' | 'customIcon'> = {
  ...DEFAULT_QR_OPTIONS,
  size: 260,
  margin: 6,
  iconPadding: 6,
  iconSizeOverride: 0.48,
};

interface Props {
  ticketId: string;
  eventTitle: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  onClose: () => void;
  onCheckedIn?: (checkedInAt: string) => void;
}

export default function FullscreenQR({ ticketId, eventTitle, eventDate, eventLocation, onClose, onCheckedIn }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(60);
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCode = useCallback(async () => {
    // Once checked in there's nothing left to show a code for, and the /qr
    // endpoint would just reject with "not active" anyway.
    if (checkedIn) return;

    // Always cancel any pending scheduled refresh before fetching — otherwise
    // a visibility/focus-triggered call (below) races the normal timer chain
    // and both keep independently rescheduling themselves forever.
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
      refreshTimeout.current = null;
    }
    try {
      const res = await fetch(`/api/tickets/${ticketId}/qr`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load code');
        return;
      }
      setError('');
      setCode(data.code);
      setQrData(data.qr_data);
      setExpiresIn(data.expires_in);
      // Refresh a couple seconds before it actually expires, so there's never
      // a moment where a stale/rejected code is on screen.
      const delayMs = Math.max((data.expires_in - 2) * 1000, 1000);
      refreshTimeout.current = setTimeout(fetchCode, delayMs);
    } catch {
      setError('Network error');
    }
  }, [ticketId, checkedIn]);

  useEffect(() => {
    fetchCode();
    return () => { if (refreshTimeout.current) clearTimeout(refreshTimeout.current); };
  }, [fetchCode]);

  // Mobile browsers throttle or fully pause setTimeout while a tab is
  // backgrounded (screen lock, switching apps) — exactly what happens while
  // someone waits in line. The scheduled refresh above may never have fired,
  // leaving a stale, now-rejected code on screen. Force a fresh one the
  // instant the page is visible again instead of waiting on that timer.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchCode();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchCode]);

  // Fires exactly once — from whichever of Realtime (fast path) or the
  // polling backstop below (guaranteed path) notices the check-in first.
  const handledCheckIn = useRef(false);
  function handleCheckedIn(checkedInAt: string) {
    if (handledCheckIn.current) return;
    handledCheckIn.current = true;
    setCheckedIn(true);
    onCheckedInRef.current?.(checkedInAt);
  }

  // Live push from the checkin scanner's DB write (see the
  // enable_tickets_realtime migration) — lets this screen show "Checked In"
  // the instant staff scan it. Stored in a ref so the subscription doesn't
  // need to be torn down and rebuilt whenever the parent passes a new
  // onCheckedIn closure.
  const onCheckedInRef = useRef(onCheckedIn);
  useEffect(() => { onCheckedInRef.current = onCheckedIn; }, [onCheckedIn]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-checkin-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; checked_in_at?: string | null };
          if (newRow.status === 'used') handleCheckedIn(newRow.checked_in_at ?? new Date().toISOString());
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Backstop for the Realtime subscription above — a websocket can fail to
  // connect for reasons that have nothing to do with this app (a campus
  // wifi proxy blocking upgrades, a misconfigured project, etc.), and
  // "check-in doesn't show up" is bad enough that this shouldn't depend on
  // Realtime alone. Polls a tiny status endpoint every few seconds; stops
  // once checked in.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (handledCheckIn.current) return;
      try {
        const res = await fetch(`/api/tickets/${ticketId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'used') handleCheckedIn(data.checked_in_at ?? new Date().toISOString());
      } catch {
        // ignore — next tick tries again
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Give the "You're Checked In!" confirmation a moment on screen, then
  // return to the ticket list — which, thanks to onCheckedIn above, already
  // shows this ticket's status as checked in by the time this lands.
  useEffect(() => {
    if (!checkedIn) return;
    const timeout = setTimeout(onClose, 2500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedIn]);

  // Close on backdrop tap
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const dateLabel = eventDate
    ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  // qr_data is `${eventSlug}:${rotatingCode}` (see /api/tickets/[id]/qr) —
  // reuse that same slug for the icon text so it can never drift out of sync
  // with what the code actually encodes. Falls back to the title for events
  // with no slug set.
  const eventLabel = (qrData?.includes(':') ? qrData.split(':')[0] : '') || eventTitle;
  const qrIcon = useMemo(() => eventLabelIcon(eventLabel), [eventLabel]);

  return (
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.sheet}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        {/* Which event this ticket is for — shown first and prominently so it
            can't be confused with a different event's ticket. */}
        <div className={styles.eventBlock}>
          <span className={styles.eventEyebrow}>🎟️ TICKET FOR</span>
          <div className={styles.eventName}>{eventTitle}</div>
          {(dateLabel || eventLocation) && (
            <div className={styles.eventMeta}>
              {dateLabel}
              {dateLabel && eventLocation && ' · '}
              {eventLocation}
            </div>
          )}
        </div>

        {checkedIn ? (
          <div className={styles.checkedInState}>
            <div className={styles.checkedInIcon} aria-hidden="true">✓</div>
            <div className={styles.checkedInTitle}>You&apos;re Checked In!</div>
            <p className={styles.hint}>Have a great time — see you inside.</p>
          </div>
        ) : (
          <>
            <div className={styles.label}>
              SHOW THIS AT CHECK-IN
              <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
            </div>

            <div className={styles.qrWrapper}>
              {qrData ? (
                <StyledQRCode
                  options={{ ...TICKET_QR_BASE, data: qrData, icon: 'custom', customIcon: qrIcon }}
                  className={styles.qrCanvas}
                />
              ) : (
                <div className={styles.qrCanvas} style={{ width: 260, height: 260 }} aria-hidden="true" />
              )}
            </div>

            {code && (
              <>
                <div className={styles.progressTrack}>
                  <div key={code} className={styles.progressBar} style={{ animationDuration: `${expiresIn}s` }} />
                </div>
                <div className={styles.codeText}>
                  Scanner not working? Ask staff to type: <strong># {code.toUpperCase()}</strong>
                </div>
              </>
            )}
            {error && <div className={styles.codeText}>{error}</div>}

            <p className={styles.hint}>
              This code refreshes automatically, so a screenshot from earlier
              won&apos;t scan. Just keep this screen open when it&apos;s your turn —
              check-in reads whatever code is showing at that moment.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
