'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';
import styles from './fullscreenqr.module.css';

interface Props {
  ticketCode: string;
  eventTitle: string;
  onClose: () => void;
}

export default function FullscreenQR({ ticketCode, eventTitle, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, ticketCode, {
      width: 260,
      margin: 2,
      color: { dark: '#011941', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    });
  }, [ticketCode]);

  // Close on backdrop tap
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.sheet}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        <div className={styles.label}>SHOW THIS AT CHECK-IN</div>

        <div className={styles.qrWrapper}>
          <canvas ref={canvasRef} className={styles.qrCanvas} />
        </div>

        <div className={styles.eventName}>{eventTitle}</div>
        <div className={styles.codeText}># {ticketCode.substring(0, 8).toUpperCase()}</div>

        <p className={styles.hint}>
          Present this QR code to an event officer for check-in
        </p>
      </div>
    </div>
  );
}
