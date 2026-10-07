'use client';

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { buildQRCodeStylingOptions, type QRCodeOptions } from '@/lib/qr/qrCodeStyling';

export interface StyledQRCodeHandle {
  download: (name: string) => Promise<void>;
  /** Puts the code on the clipboard as an image; false when the browser does not allow it. */
  copy: () => Promise<boolean>;
}

interface Props {
  options: QRCodeOptions;
  className?: string;
}

// Bare TG-branded QR canvas — no surrounding chrome. Shared by the portal's
// QR Studio (full customization) and the ticket QR (fixed preset), so both
// stay pixel-for-pixel consistent with the same underlying render logic.
const StyledQRCode = forwardRef<StyledQRCodeHandle, Props>(function StyledQRCode({ options, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    const built = buildQRCodeStylingOptions(options);

    if (!qrRef.current) {
      qrRef.current = new QRCodeStyling(built);
    } else {
      qrRef.current.update(built);
    }

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      qrRef.current.append(containerRef.current);
    }
  }, [options]);

  useImperativeHandle(ref, () => ({
    download: async (name: string) => {
      if (!qrRef.current) return;
      await qrRef.current.download({ name, extension: options.downloadFormat });
    },
    copy: async () => {
      try {
        const raw = await qrRef.current?.getRawData('png');
        if (!raw || typeof ClipboardItem === 'undefined') return false;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': raw as Blob })]);
        return true;
      } catch { return false; }
    },
  }), [options.downloadFormat]);

  return <div ref={containerRef} className={className} />;
});

export default StyledQRCode;
