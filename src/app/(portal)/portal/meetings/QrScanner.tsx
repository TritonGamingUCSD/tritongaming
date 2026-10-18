'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import RingIcon from '@/components/RingCode/RingIcon';
import { X, Zap, ZapOff } from 'lucide-react';
import jsQR from 'jsqr';
import { decodeRingCode } from '@/lib/qr/ringCode/decode';
import styles from './meetings.module.css';

interface Caps { zoom?: { min: number; max: number; step: number }; torch?: boolean }
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A full-screen camera with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Pinching only zooms, in and out of the middle of the picture; it never pans. Reads the QR and hands the
// text to the caller; nothing is recorded or uploaded.
export default function QrScanner({ onScan, onClose, title = 'Scan A QR Code', note, footer }: { onScan: (text: string) => boolean | void; onClose: () => void; title?: string; note?: string; footer?: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<ZoomTrack | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Caps>({});
  const [torch, setTorch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // The zoom lives in refs, not state: a pinch fires many times a second and re-rendering for each one is what made it lag.
  const zoomRef = useRef(1);
  const digitalRef = useRef(true);
  digitalRef.current = !caps.zoom;
  const capsRef = useRef<Caps>({});
  capsRef.current = caps;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    // The page behind must not scroll or zoom while the camera is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let stream: MediaStream | null = null, raf = 0, dead = false, last = 0, lastText = '', lastAt = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        const t = stream.getVideoTracks()[0] as ZoomTrack;
        track.current = t;
        const c = t.getCapabilities?.() as Caps | undefined;
        if (c) setCaps({ zoom: c.zoom && c.zoom.max > c.zoom.min ? c.zoom : undefined, torch: !!c.torch });
        if (c?.zoom) { zoomRef.current = Math.min(Math.max(c.zoom.min, 1), c.zoom.max); setActive(zoomRef.current); hw.current.want = zoomRef.current; hw.current.applied = -1; applyHardware(); }   // start at 1×, not the ultra-wide the camera may open on
        if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => {}); }
        const tick = async (now: number) => {
          raf = requestAnimationFrame(tick);
          const v = video.current;
          if (dead || !v || v.readyState < 2 || now - last < 140) return;
          last = now;
          let text: string | null = null;
          // Digital zoom crops the middle of the picture before reading it.
          const z = digitalRef.current ? zoomRef.current : 1;
          const w = v.videoWidth / z, h = v.videoHeight / z;
          if (detector && z === 1) { try { text = (await detector.detect(v))[0]?.rawValue ?? null; } catch { /* fall back below */ } }
          if (!text && ctx) {
            canvas.width = Math.min(720, w); canvas.height = Math.round(canvas.width * (h / w));
            ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // A QR first (an event's check-in link and the like), then the portal's own ring code.
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
            if (!text) {
              const gray = new Uint8ClampedArray(img.width * img.height);
              for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (img.data[j] * 77 + img.data[j + 1] * 150 + img.data[j + 2] * 29) >> 8;
              const ring = decodeRingCode(gray, img.width, img.height);
              if (ring) text = `ring:${ring}`;
            }
          }
          // The caller decides what the text is: true = taken (stop the camera), anything else = keep looking. The same text is not offered again for 3 s.
          if (text && !(text === lastText && now - lastAt < 3000)) {
            lastText = text; lastAt = now;
            if (onScanRef.current(text) === true) { dead = true; navigator.vibrate?.(40); stream?.getTracks().forEach((x) => x.stop()); }
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const insecure = typeof window !== 'undefined' && !window.isSecureContext;   // a phone only lets a page use its camera over https
        setError(insecure ? 'This page isn’t on a secure (https) connection, so the phone won’t let it use the camera. Type the code below instead.' : (e as Error)?.name === 'NotAllowedError' ? 'The camera is blocked. Allow it in your browser’s settings, or type the code below instead.' : 'Couldn’t open the camera. Type the code below instead.');
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // The phone's own zoom takes one request at a time: while one is being applied, only the newest wanted value waits behind it.
  const hw = useRef({ busy: false, want: 1, applied: 1 });
  function applyHardware() {
    const h = hw.current;
    if (h.busy || h.want === h.applied || !track.current) return;
    h.busy = true; h.applied = h.want;
    track.current.applyConstraints({ advanced: [{ zoom: h.want }] }).catch(() => { /* keep going */ }).finally(() => { h.busy = false; applyHardware(); });
  }
  const min = caps.zoom?.min ?? 1, max = caps.zoom ? Math.min(caps.zoom.max, 8) : 3;
  const clampZoom = (v: number) => Math.max(min, Math.min(max, v));
  const paint = useRef(0);
  function setZoomTo(v: number) {
    zoomRef.current = clampZoom(v);
    cancelAnimationFrame(paint.current);
    paint.current = requestAnimationFrame(() => {
      if (digitalRef.current) { if (video.current) video.current.style.transform = zoomRef.current > 1 ? `scale(${zoomRef.current})` : ''; }
      else { hw.current.want = zoomRef.current; applyHardware(); }
    });
  }
  async function toggleTorch() {
    const next = !torch;
    try { await track.current?.applyConstraints({ advanced: [{ torch: next }] }); setTorch(next); } catch { /* not supported after all */ }
  }
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    const types = ['gesturestart', 'gesturechange', 'gestureend', 'touchmove'];
    types.forEach((t) => el.addEventListener(t, stop, { passive: false }));
    return () => types.forEach((t) => el.removeEventListener(t, stop));
  }, [mounted]);
  // Fixed steps, like the phone's own camera: tap 1×, 2×, 3×… Each tap is one zoom request, so there is nothing to lag. The steps follow what the camera can
  // really do (an ultra-wide 0.5× where it has one); without hardware zoom they are a digital crop of the middle, up to 3×.
  const steps = [0.5, 1, 2, 3, 5].filter((z) => z >= min - 0.01 && z <= max + 0.01);
  const [active, setActive] = useState(1);
  function pick(z: number) { setActive(z); setZoomTo(z); }
  useEffect(() => { if (caps.zoom && !steps.includes(1)) setActive(steps[0] ?? min); }, [caps.zoom]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  // Portaled to the page itself: the portal's panels are animated with a transform, which would otherwise shrink a "fixed" overlay to the panel.
  return createPortal(
    <div className={styles.scanScreen} role="dialog" aria-modal="true" aria-label={title}>
      <header className={styles.scanTop}>
        <span className={styles.scanTitle}>{title}</span>
        <button type="button" className={styles.scanClose} onClick={onClose} aria-label="Close scanner"><X size={22} aria-hidden="true" /></button>
      </header>
      {error ? <div className={styles.scanProblem}><RingIcon size={44} /><p>{error}</p></div> : (
        <div ref={frame} className={styles.scanStage}>
          <video ref={video} playsInline muted />
          <div className={styles.scanTarget} aria-hidden="true">
          </div>
        </div>
      )}
      <footer className={styles.scanBottom}>
        <p className={styles.scanHint}>{note ?? 'Point the camera at the QR code.'}</p>
        <div className={styles.scanRow}>
          <div className={styles.scanSteps} role="group" aria-label="Zoom">
            {steps.map((z) => <button key={z} type="button" className={`${styles.scanStep} ${active === z ? styles.scanStepOn : ''}`} onClick={() => pick(z)} aria-pressed={active === z}>{z < 1 ? '.5' : z}×</button>)}
          </div>
          {caps.torch && <button type="button" className={styles.scanLight} onClick={() => void toggleTorch()} aria-pressed={torch}>{torch ? <ZapOff size={16} aria-hidden="true" /> : <Zap size={16} aria-hidden="true" />} {torch ? 'Light Off' : 'Light On'}</button>}
        </div>
        {footer}
      </footer>
    </div>,
    document.body,
  );
}
