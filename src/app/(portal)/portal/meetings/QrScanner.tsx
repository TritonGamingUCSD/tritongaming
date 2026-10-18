'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Zap, ZapOff } from 'lucide-react';
import jsQR from 'jsqr';
import styles from './meetings.module.css';

// What a scan proves: the room QR is not a link. It carries `tgm1.<meeting>.<key>`, a key of its own (not the typed digits) that changes every 30 s.
// Only this scanner reads it; a phone's own camera shows nothing useful.
export type CheckInProof = { meeting_id: string; key: string };
export function proofFromScan(text: string): CheckInProof | null {
  const m = text.trim().match(/^tgm1\.([0-9a-f-]{36})\.([0-9a-f]{24})$/i);
  return m ? { meeting_id: m[1], key: m[2] } : null;
}

interface Caps { zoom?: { min: number; max: number; step: number }; torch?: boolean }
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A full-screen camera with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Pinching only zooms, in and out of the middle of the picture; it never pans. Reads the QR and hands the
// text to the caller; nothing is recorded or uploaded.
export default function QrScanner({ onScan, onClose, title = 'Scan A QR Code', note }: { onScan: (text: string) => boolean | void; onClose: () => void; title?: string; note?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
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
        if (c?.zoom) { zoomRef.current = c.zoom.min; showZoom(); }
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
            canvas.width = Math.min(640, w); canvas.height = Math.round(canvas.width * (h / w));
            ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
          }
          // The caller decides what the text is: true = taken (stop the camera), anything else = keep looking. The same text is not offered again for 3 s.
          if (text && !(text === lastText && now - lastAt < 3000)) {
            lastText = text; lastAt = now;
            if (onScanRef.current(text) === true) { dead = true; navigator.vibrate?.(40); stream?.getTracks().forEach((x) => x.stop()); }
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError((e as Error)?.name === 'NotAllowedError' ? 'The camera is blocked. Allow it in your browser settings, or type the code instead.' : 'Couldn’t open the camera. Type the code instead.');
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  function showZoom() { if (badge.current) badge.current.textContent = `${zoomRef.current.toFixed(1)}×`; }
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
      showZoom();
      if (digitalRef.current) { if (video.current) video.current.style.transform = zoomRef.current > 1 ? `scale(${zoomRef.current})` : ''; }
      else { hw.current.want = zoomRef.current; applyHardware(); }
    });
  }
  async function toggleTorch() {
    const next = !torch;
    try { await track.current?.applyConstraints({ advanced: [{ torch: next }] }); setTorch(next); } catch { /* not supported after all */ }
  }
  // Two fingers on the picture zoom it (a trackpad pinch, or ctrl + scroll, does the same on a computer). Only the distance between the fingers
  // matters, so moving both fingers together changes nothing. The browser's own page zoom and scrolling are switched off over the picture.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startPinch = useRef<{ dist: number; zoom: number } | null>(null);
  const dist = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    const types = ['gesturestart', 'gesturechange', 'gestureend', 'touchmove'];
    types.forEach((t) => el.addEventListener(t, stop, { passive: false }));
    return () => types.forEach((t) => el.removeEventListener(t, stop));
  }, [mounted]);
  const pinch = {
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) startPinch.current = { dist: dist(), zoom: zoomRef.current }; },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && startPinch.current && startPinch.current.dist > 0) setZoomTo(startPinch.current.zoom * (dist() / startPinch.current.dist));
    },
    onPointerUp: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); startPinch.current = null; },
    onPointerCancel: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); startPinch.current = null; },
    onWheel: (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) setZoomTo(zoomRef.current * (e.deltaY < 0 ? 1.08 : 0.93)); },
  };

  if (!mounted) return null;
  // Portaled to the page itself: the portal's panels are animated with a transform, which would otherwise shrink a "fixed" overlay to the panel.
  return createPortal(
    <div className={styles.scanScreen} role="dialog" aria-modal="true" aria-label={title}>
      <header className={styles.scanTop}>
        <span className={styles.scanTitle}>{title}</span>
        <button type="button" className={styles.scanClose} onClick={onClose} aria-label="Close scanner"><X size={22} aria-hidden="true" /></button>
      </header>
      {error ? <p className={styles.scanError}>{error}</p> : (
        <div ref={frame} className={styles.scanStage} {...pinch}>
          <video ref={video} playsInline muted />
          <div className={styles.scanTarget} aria-hidden="true">
            <i /><i /><i /><i />
            <span className={styles.scanLine} />
          </div>
          <span ref={badge} className={styles.scanZoom} aria-live="off">1.0×</span>
        </div>
      )}
      <footer className={styles.scanBottom}>
        <p className={styles.scanHint}>{note ?? 'Point the camera at the QR code.'}</p>
        <div className={styles.scanRow}>
          <span className={styles.scanPinch}>Pinch to zoom</span>
          {caps.torch && <button type="button" className={styles.scanLight} onClick={() => void toggleTorch()} aria-pressed={torch}>{torch ? <ZapOff size={16} aria-hidden="true" /> : <Zap size={16} aria-hidden="true" />} {torch ? 'Light Off' : 'Light On'}</button>}
        </div>
      </footer>
    </div>,
    document.body,
  );
}
