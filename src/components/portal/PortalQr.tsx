'use client';

import { useMemo } from 'react';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { codeLink } from '@/lib/qr/codeLink';
import styles from './PortalQr.module.css';

// The QR code option of the portal's own codes (see lib/qr/codeLink.ts): the standard Triton Gaming QR design (rounded blue modules, gold corners, the TG logo in the middle: the same as the tickets' and the
// trivia join code) holding a link to the portal page for the code, so a phone's own camera opens it. Only drawn in the browser (the link starts with the address the page is open on).
export default function PortalQr({ payload, label = 'QR code for the portal' }: { payload: string; label?: string }) {
  const options = useMemo(
    () => ({ ...DEFAULT_QR_OPTIONS, data: codeLink(payload, typeof window === 'undefined' ? 'https://tritongaming.org' : window.location.origin), size: 520, margin: 8 }),
    [payload],
  );
  return (
    <div className={styles.box} role="img" aria-label={label}>
      <StyledQRCode options={options} />
    </div>
  );
}
