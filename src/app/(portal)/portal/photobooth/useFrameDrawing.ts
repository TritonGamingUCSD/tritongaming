'use client';

import { useEffect, useState } from 'react';
import { cellSize, type Aspect, type FrameSpec } from '@/lib/photobooth/booth';
import { drawFrame } from '@/lib/photobooth/design';
import { loadImage } from '@/lib/photobooth/compose';

// A drawing of a booth's frame as a picture address, for the previews on its setup page: it follows every change (the logo is loaded first when there is one). Browser only.
export function useFrameDrawing(spec: FrameSpec | null, aspect: Aspect, logoSrc: string): string {
  const [url, setUrl] = useState('');
  const key = JSON.stringify([spec, aspect, logoSrc]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!spec) return setUrl('');
      const logo = logoSrc ? await loadImage(logoSrc).catch(() => null) : null;
      if (!alive) return;
      const { w, h } = cellSize(aspect);
      const canvas = document.createElement('canvas');
      canvas.width = w / 2;
      canvas.height = h / 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(0.5, 0.5);
      drawFrame(ctx, w, h, { ...spec, aspect, logo });
      setUrl(canvas.toDataURL('image/png'));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}
