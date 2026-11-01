'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// The camera for the booth: the front (or only) camera as large as the device gives, kept on while the booth is open and switched off when it closes. `error` is a sentence for the screen.
export function useCamera() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const start = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) return setError('This browser cannot use the camera. Open the booth in Chrome or Safari on a laptop or tablet.');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stream.current = s;
      const v = video.current;
      if (v) {
        v.srcObject = s;
        await v.play().catch(() => undefined);
      }
      setReady(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setError(
        name === 'NotAllowedError'
          ? 'The camera is blocked. Allow it for this site in the browser, then try again.'
          : name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : 'The camera could not start. Close other apps using it and try again.',
      );
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void start(), 0);
    return () => {
      window.clearTimeout(t);
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
    };
  }, [start]);

  return { video, ready, error, retry: start };
}
