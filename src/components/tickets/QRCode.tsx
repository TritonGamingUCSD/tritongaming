'use client';

import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface Props {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

export default function QRCode({ value, size = 200, bgColor = '#ffffff', fgColor = '#011941' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: 'H',
    });
  }, [value, size, bgColor, fgColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: '0.5rem', display: 'block' }}
      aria-label={`QR code for ticket ${value.substring(0, 8)}`}
    />
  );
}
