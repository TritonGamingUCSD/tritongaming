'use client';

import { useMemo } from 'react';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qr/qrCodeStyling';
import { codeLink } from '@/lib/qr/codeLink';
import styles from './PortalQr.module.css';

// The QR code option of the portal's own codes (see lib/qr/codeLink.ts): the standard Triton Gaming QR design (rounded blue modules, gold corners, the TG logo in the middle: the same as the tickets' and the
// trivia join code) holding a link to the portal page for the code, so a phone's own camera opens it. It has no background of its own: the light theme draws the standard dark-blue modules, the dark theme the
// same design in light modules (both are drawn and the page's theme shows one). Only drawn in the browser (the link starts with the address the page is open on).
const LIGHT: Partial<QRCodeOptions> = { dotsGradientStartColor: '#56789f', cornersSquareColor: '#c46a00', cornersDotColor: '#e08a00' }; // (a little deeper, so it reads on a card that is not white)
const DARK: Partial<QRCodeOptions> = { dotsGradientStartColor: '#a9cdf2', dotsGradientEndColor: '#ece9e2', dotsColor: '#ece9e2' };

export default function PortalQr({ payload, label = 'QR code for the portal' }: { payload: string; label?: string }) {
  const [light, dark] = useMemo(() => {
    const base = {
      ...DEFAULT_QR_OPTIONS,
      transparentBg: true,
      data: codeLink(payload, typeof window === 'undefined' ? 'https://tritongaming.org' : window.location.origin),
      size: 520,
      margin: 8,
    };
    return [
      { ...base, ...LIGHT },
      { ...base, ...DARK },
    ];
  }, [payload]);
  return (
    <div className={styles.box} role="img" aria-label={label}>
      <div className={styles.light}>
        <StyledQRCode options={light} />
      </div>
      <div className={styles.dark}>
        <StyledQRCode options={dark} />
      </div>
    </div>
  );
}
