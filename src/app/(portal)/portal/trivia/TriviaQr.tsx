'use client';

import { useEffect, useRef } from 'react';
import styles from './trivia.module.css';

// A plain black-on-white QR code (the same kind any phone camera reads; not the circular TGcode) for a game's join address.
export default function TriviaQr({ url, size = 220 }: { url: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (!alive || !ref.current) return;
      ref.current.innerHTML = '';
      new QRCodeStyling({ width: size, height: size, type: 'svg', data: url, margin: 0, qrOptions: { errorCorrectionLevel: 'M' }, dotsOptions: { type: 'square', color: '#000000' }, backgroundOptions: { color: '#ffffff' }, cornersSquareOptions: { type: 'square', color: '#000000' }, cornersDotOptions: { type: 'square', color: '#000000' } }).append(ref.current);   // theme-ok: black on white so any camera reads it
    });
    return () => { alive = false; };
  }, [url, size]);
  return <div className={styles.qrBox}><div ref={ref} style={{ width: size, height: size }} role="img" aria-label={`QR code to join: ${url}`} /></div>;
}
