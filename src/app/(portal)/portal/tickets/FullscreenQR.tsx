'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import QRCodeLib from 'qrcode';
import styles from './fullscreenqr.module.css';

interface Props {
  ticketId: string;
  eventTitle: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  onClose: () => void;
}

export default function FullscreenQR({ ticketId, eventTitle, eventDate, eventLocation, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(60);
  const [error, setError] = useState('');
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCode = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/qr`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load code');
        return;
      }
      setError('');
      setCode(data.code);
      setExpiresIn(data.expires_in);
      // Refresh a couple seconds before it actually expires, so there's never
      // a moment where a stale/rejected code is on screen.
      const delayMs = Math.max((data.expires_in - 2) * 1000, 1000);
      refreshTimeout.current = setTimeout(fetchCode, delayMs);
    } catch {
      setError('Network error');
    }
  }, [ticketId]);

  useEffect(() => {
    fetchCode();
    return () => { if (refreshTimeout.current) clearTimeout(refreshTimeout.current); };
  }, [fetchCode]);

  useEffect(() => {
    if (!canvasRef.current || !code) return;
    QRCodeLib.toCanvas(canvasRef.current, code, {
      width: 260,
      margin: 2,
      color: { dark: '#011941', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  }, [code]);

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

        <div className={styles.label}>
          SHOW THIS AT CHECK-IN
          <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
        </div>

        <div className={styles.qrWrapper}>
          {code ? (
            <canvas ref={canvasRef} className={styles.qrCanvas} />
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
      </div>
    </div>
  );
}
