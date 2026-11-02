'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const REMEMBERED = 'pb-camera';

/** One camera the computer can use (a built-in camera, a webcam, or a mirrorless camera through a capture card). */
export interface CameraChoice {
  id: string;
  label: string;
}

/** What the booth can tell about the camera in use (for the Camera Check). `controls` are the settings the browser is allowed to change on it, in plain words. */
export interface CameraInfo {
  label: string;
  width: number;
  height: number;
  fps: number;
  controls: string[];
}

const CONTROLS: Record<string, string> = {
  exposureMode: 'Exposure mode',
  exposureCompensation: 'Exposure',
  exposureTime: 'Shutter time',
  iso: 'ISO',
  whiteBalanceMode: 'White balance mode',
  colorTemperature: 'White balance',
  brightness: 'Brightness',
  contrast: 'Contrast',
  saturation: 'Saturation',
  sharpness: 'Sharpness',
  focusMode: 'Focus mode',
  focusDistance: 'Focus distance',
  zoom: 'Zoom',
  torch: 'Light',
};

const remembered = (): string => {
  try {
    return window.localStorage.getItem(REMEMBERED) ?? '';
  } catch {
    return '';
  }
};
const remember = (id: string) => {
  try {
    if (id) window.localStorage.setItem(REMEMBERED, id);
    else window.localStorage.removeItem(REMEMBERED);
  } catch {
    /* (a private window cannot remember: the booth still works) */
  }
};

// The camera for the booth: the one chosen on this computer last time (or the front or only camera), as large as it gives, kept on while the booth is open and switched off when it closes. `cameras` lists every camera once the browser
// has allowed the camera (names only show then); `choose` switches camera and remembers the choice for this computer. `error` is a sentence for the screen.
export function useCamera() {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState<CameraChoice[]>([]);
  const [current, setCurrent] = useState('');
  const [info, setInfo] = useState<CameraInfo | null>(null);

  // The picture element only exists once the booth has loaded, which can be after the camera is already on: whichever comes second connects them.
  const attach = useCallback((node: HTMLVideoElement | null) => {
    video.current = node;
    if (node && stream.current && node.srcObject !== stream.current) {
      node.srcObject = stream.current;
      void node.play().catch(() => undefined);
    }
  }, []);

  const open = useCallback(async (deviceId: string) => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) return setError('This browser cannot use the camera. Open the booth in Chrome or Safari on a laptop or a computer with a camera.');
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    setReady(false);
    const size = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: 'user', ...size }, audio: false });
      } catch (e) {
        // (a camera that was unplugged since last time: go back to the default one)
        if (!deviceId || (e as DOMException).name === 'NotAllowedError') throw e;
        remember('');
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', ...size }, audio: false });
      }
      stream.current = s;
      setCurrent(s.getVideoTracks()[0]?.getSettings().deviceId ?? '');
      const v = video.current;
      if (v) {
        v.srcObject = s;
        await v.play().catch(() => undefined);
      }
      const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCameras(all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
      const track = s.getVideoTracks()[0];
      const got = track?.getSettings() ?? {};
      const caps = (track as MediaStreamTrack & { getCapabilities?: () => Record<string, unknown> }).getCapabilities?.() ?? {};
      setInfo({
        label: all.find((d) => d.deviceId === got.deviceId)?.label || track?.label || 'Camera',
        width: got.width ?? 0,
        height: got.height ?? 0,
        fps: Math.round(got.frameRate ?? 0),
        controls: Object.keys(CONTROLS)
          .filter((k) => k in caps)
          .map((k) => CONTROLS[k]),
      });
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

  const choose = useCallback(
    (id: string) => {
      remember(id);
      void open(id);
    },
    [open],
  );
  const retry = useCallback(() => open(remembered()), [open]);

  useEffect(() => {
    const t = window.setTimeout(() => void open(remembered()), 0);
    return () => {
      window.clearTimeout(t);
      stream.current?.getTracks().forEach((tr) => tr.stop());
      stream.current = null;
    };
  }, [open]);

  return { video, attach, ready, error, retry, cameras, current, choose, info };
}
