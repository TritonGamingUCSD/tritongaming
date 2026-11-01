'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { photoLink } from '@/lib/photobooth/booth';
import styles from './photobooth.module.css';

const StyledQRCode = dynamic(() => import('@/components/StyledQRCode/StyledQRCode'), { ssr: false, loading: () => null }); // (the QR library needs the browser)

// The picture and the Triton Gaming QR code for its page, with the seconds left shown as a bar. When the time is up (or Next Guest is pressed) the booth goes back to its welcome screen.
export function QrScreen({ token, picture, seconds, onDone }: { token: string; picture: string; seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  const options = useMemo(() => ({ ...DEFAULT_QR_OPTIONS, data: photoLink(token, window.location.origin), size: 560, margin: 10 }), [token]);
  return (
    <div className={styles.qrScreen}>
      <div className={styles.qrPicture}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt="Your finished picture" />
      </div>
      <div className={styles.qrSide}>
        <h2 className={styles.qrTitle}>Scan To Download</h2>
        <p className={styles.qrText}>Point your phone’s camera at the code.</p>
        <div className={styles.qrCode}>
          <StyledQRCode options={options} />
        </div>
        <div className={styles.qrBar} aria-hidden="true">
          <span style={{ width: `${Math.max(0, (left / seconds) * 100)}%` }} />
        </div>
        <button type="button" className={styles.bigBtn} onClick={onDone}>
          Next Guest
        </button>
      </div>
    </div>
  );
}
