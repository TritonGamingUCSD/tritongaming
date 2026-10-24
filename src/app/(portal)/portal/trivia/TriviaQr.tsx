'use client';

import { useMemo } from 'react';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import styles from './trivia.module.css';

// The game's join address as the Triton Gaming QR code: the same branded design as the tickets (rounded blue modules, gold corners, the TG logo in the middle). It is a real QR code that any phone camera
// reads, and the portal's own Scan button opens it too (it is a link to a page of the portal).
export default function TriviaQr({ url, size = 220 }: { url: string; size?: number }) {
  const options = useMemo(() => ({ ...DEFAULT_QR_OPTIONS, data: url, size: 520, margin: 8 }), [url]);
  return (
    <div className={styles.qrBox} style={{ width: size, height: size }} role="img" aria-label={`QR code to join: ${url}`}>
      <StyledQRCode options={options} className={styles.qrCanvas} />
    </div>
  );
}
