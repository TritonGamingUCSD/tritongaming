'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import StyledQRCode from '@/components/StyledQRCode/StyledQRCode';
import { qrBadgeOptionsFromQR, drawQRBadge } from '@/lib/qr/qrBadge';
import type { QRCodeOptions } from '@/lib/qr/qrCodeStyling';
import styles from './TicketQRBadge.module.css';

interface Props {
  options: QRCodeOptions;
  eventLabel: string;
  className?: string;
  /** Called once if the poll below times out without ever finding a painted
   * canvas — lets the caller (FullscreenQR) show an explicit "use the code
   * instead" message rather than leaving a silently blank box on screen. */
  onFail?: () => void;
}

// Renders the real (untouched, square) QR into a hidden container via the
// existing StyledQRCode, then copies its canvas into a visible one that
// draws the circular badge around/through it — see qrBadge.ts for how the
// crop stays scan-safe. Kept separate from StyledQRCode itself rather than
// baking this in there, since QR Studio still wants the bare square output.
export default function TicketQRBadge({ options: wanted, eventLabel, className, onFail }: Props) {
  // On a slow connection the logo in the middle can take a long time to arrive, and the code is not drawn until it has. After a few seconds the code is drawn
  // without the logo instead (it scans just the same), and only if even that does not appear is the person told to use the typed code.
  const [plain, setPlain] = useState(false);
  const options = useMemo(() => (plain ? { ...wanted, icon: 'none' as const, customIcon: null } : wanted), [plain, wanted]);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // qr-code-styling's own render (inside StyledQRCode) isn't synchronous
    // when there's a logo image to composite in — it loads/decodes that
    // image before the canvas is actually fully drawn. A single
    // requestAnimationFrame right after mount reliably fired too early,
    // copying out a still-blank canvas (same white as the badge's own
    // backdrop, so the QR silently never appeared). Poll instead: keep
    // copying until the hidden canvas actually has non-white pixels, with a
    // timeout so a genuinely blank/failed QR doesn't loop forever.
    let cancelled = false;
    let rafId = 0;
    let attempts = 0;

    const tick = () => {
      if (cancelled) return;
      const qrCanvas = hiddenRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
      const outCanvas = canvasRef.current;
      if (qrCanvas && outCanvas && qrCanvas.width > 0) {
        const ctx = qrCanvas.getContext('2d');
        const hasContent = ctx
          ? (() => {
              const { data } = ctx.getImageData(0, 0, qrCanvas.width, qrCanvas.height);
              // A freshly-created, not-yet-painted canvas reads back as
              // (0,0,0,0) — fully transparent black. That has R=0, which a
              // naive "any channel below 250" check treats as "content
              // found" (false positive, on nothing), so the composite ran
              // immediately on a still-blank canvas and the QR silently
              // never appeared. Require full opacity *and* a dark channel —
              // an actually-painted dot/corner, not empty canvas memory.
              for (let i = 0; i < data.length; i += 4 * 37) {
                if (data[i + 3] === 255 && (data[i] < 230 || data[i + 1] < 230 || data[i + 2] < 230)) return true;
              }
              return false;
            })()
          : false;
        if (hasContent) {
          drawQRBadge(outCanvas, qrCanvas, qrBadgeOptionsFromQR(options, eventLabel));
          return;
        }
      }
      attempts++;
      if (attempts < 240) {
        rafId = requestAnimationFrame(tick); // ~4s at 60fps
      } else if (!plain && wanted.icon !== 'none') {
        setPlain(true);   // draw it again without the logo, which restarts this wait
      } else {
        onFail?.();
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, eventLabel]);

  return (
    <div className={className}>
      <div ref={hiddenRef} className={styles.hidden} aria-hidden="true">
        <StyledQRCode options={options} />
      </div>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
