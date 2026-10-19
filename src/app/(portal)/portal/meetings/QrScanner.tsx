'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import TGcodeIcon from '@/components/TGcode/TGcodeIcon';
import { Check, CircleAlert, TriangleAlert, X, Zap, ZapOff } from 'lucide-react';
import jsQR from 'jsqr';
import { decodeTGcodeAt } from '@/lib/qr/tgCode/decode';
import { scanArea, inScanCircle } from '@/lib/qr/scanArea';
import styles from './meetings.module.css';

interface Caps { zoom?: { min: number; max: number; step: number }; torch?: boolean }
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A full-screen camera with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Pinching only zooms, in and out of the middle of the picture; it never pans. Reads the QR and hands the
// text to the caller; nothing is recorded or uploaded.
// What a scan did, shown on the camera itself: the ring locks and takes the colour of the outcome, and `sheet` (the result) slides up over the frozen picture.
// Clearing `lock` carries on scanning with the same camera, so "Scan Next" is instant.
// The middle and half-size of the points of a code's outline (video pixels).
function around(points: { x: number; y: number }[]): { x: number; y: number; r: number } | null {
  if (points.length < 3) return null;
  const x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x, y, r: Math.max(...points.map((p) => Math.hypot(p.x - x, p.y - y))) };
}
// Video pixels → where they show on the stage: the picture fills the stage with its middle kept ("cover"), then a digital zoom scales it about the middle.
function toStage(f: { x: number; y: number; r: number }, v: HTMLVideoElement, z: number): { x: number; y: number; r: number } | null {
  const stage = v.parentElement?.getBoundingClientRect();
  if (!stage || !v.videoWidth || !v.videoHeight) return null;
  const SW = stage.width, SH = stage.height, s = Math.max(SW / v.videoWidth, SH / v.videoHeight);
  const px = (SW - v.videoWidth * s) / 2 + f.x * s, py = (SH - v.videoHeight * s) / 2 + f.y * s;
  return { x: SW / 2 + (px - SW / 2) * z, y: SH / 2 + (py - SH / 2) * z, r: f.r * s * z };
}

// The ring and icon placed over the code: the code's own middle and size, kept inside the stage and never tiny or bigger than the screen.
function fit(spot: { x: number; y: number; r: number }, stage: HTMLElement | null) {
  const SW = stage?.clientWidth ?? 360, SH = stage?.clientHeight ?? 600;
  const r = Math.min(Math.max(spot.r * 1.08, 44), Math.min(SW, SH) * 0.46);
  return { x: Math.min(Math.max(spot.x, r * 0.5), SW - r * 0.5), y: Math.min(Math.max(spot.y, r * 0.5), SH - r * 0.5), r };
}
const ringBox = (spot: { x: number; y: number; r: number }, stage: HTMLElement | null): React.CSSProperties => { const f = fit(spot, stage); return { left: f.x, top: f.y, width: f.r * 2 }; };
const iconBox = (spot: { x: number; y: number; r: number }, stage: HTMLElement | null): React.CSSProperties => { const f = fit(spot, stage); const d = Math.min(Math.max(f.r * 0.9, 56), 110); return { left: f.x, top: f.y, width: d, maxWidth: 'none' }; };

export type ScanLock = { tone: 'busy' | 'ok' | 'warn' | 'bad' };
export default function QrScanner({ onScan, onClose, title = 'Scan A QR Code', note, footer, lock, sheet }: { onScan: (text: string) => boolean | void; onClose: () => void; title?: string; note?: string; footer?: ReactNode; lock?: ScanLock | null; sheet?: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<ZoomTrack | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Caps>({});
  const [torch, setTorch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [spot, setSpot] = useState<{ x: number; y: number; r: number } | null>(null);   // where on the screen the code was when it was read (stage pixels)   // the first picture is in and the zoom has settled: only then does the camera fade in
  const pausedRef = useRef(false);   // a taken scan freezes the picture and stops reading until the caller clears `lock`
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
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string; cornerPoints?: { x: number; y: number }[] }[]> } }).BarcodeDetector;
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
        if (video.current) {
          video.current.srcObject = stream; await video.current.play().catch(() => {});
          const v0 = video.current;
          for (let i = 0; i < 20 && v0.readyState < 2 && !dead; i++) await new Promise((r) => setTimeout(r, 50));
          await new Promise((r) => setTimeout(r, 300));   // the phone's zoom (back to 1×) lands a moment after the first picture
          if (!dead) setReady(true);
        }
        const tick = async (now: number) => {
          raf = requestAnimationFrame(tick);
          const v = video.current;
          if (dead || pausedRef.current || !v || v.readyState < 2 || now - last < 140) return;
          last = now;
          let text: string | null = null;
          let found: { x: number; y: number; r: number } | null = null;   // where it was, in video pixels
          // Only what is in (or very near) the circle on the screen is read, not the whole camera picture: another code at the edge of the view, or on a screen across the room, is never picked up by
          // accident. The picture is cropped to a square a little bigger than the circle (so a code that fills the circle still fits), which also gives a small code more pixels to be read from.
          const z = digitalRef.current ? zoomRef.current : 1;
          const stageEl = v.parentElement;
          const area = scanArea({ w: v.videoWidth, h: v.videoHeight }, { w: stageEl?.clientWidth ?? v.videoWidth, h: stageEl?.clientHeight ?? v.videoHeight }, { w: window.innerWidth, h: window.innerHeight }, z);
          const { cx, cy, side: L } = area;
          const inCircle = (f: { x: number; y: number; r: number } | null) => inScanCircle(area, f);
          if (detector && z === 1) {
            try {
              const hit = (await detector.detect(v))[0];
              if (hit) { const f = around(hit.cornerPoints ?? []); if (inCircle(f)) { text = hit.rawValue; found = f; } }
            } catch { /* fall back below */ }
          }
          if (!text && ctx) {
            canvas.width = Math.min(720, Math.round(L)); canvas.height = canvas.width;
            ctx.drawImage(v, cx - L / 2, cy - L / 2, L, L, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const k = L / canvas.width, ox = cx - L / 2, oy = cy - L / 2;   // the picture it read is the square in the middle, scaled to fit
            const inVideo = (p: { x: number; y: number }) => ({ x: ox + p.x * k, y: oy + p.y * k });
            // A QR first (an event's check-in link and the like), then the portal's own TGcode.
            const q = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            if (q) { const f = around([q.location.topLeftCorner, q.location.topRightCorner, q.location.bottomRightCorner, q.location.bottomLeftCorner].map(inVideo)); if (inCircle(f)) { text = q.data; found = f; } }
            if (!text) {
              const gray = new Uint8ClampedArray(img.width * img.height);
              for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (img.data[j] * 77 + img.data[j + 1] * 150 + img.data[j + 2] * 29) >> 8;
              const ring = decodeTGcodeAt(gray, img.width, img.height);
              if (ring) { const f = { x: ox + ring.spot.x * k, y: oy + ring.spot.y * k, r: ring.spot.r * k }; if (inCircle(f)) { text = `tg:${ring.payload}`; found = f; } }
            }
          }
          // The caller decides what the text is: true = taken (freeze the picture), anything else = keep looking. The same text is not offered again for 3 s.
          if (text && !(text === lastText && now - lastAt < 3000)) {
            lastText = text; lastAt = now;
            if (onScanRef.current(text) === true) {
              pausedRef.current = true; v.pause();   // freeze right away, so the ring lands where the code is in the frozen picture
              setSpot(found ? toStage(found, v, z) : null);
            }
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

  useEffect(() => {
    if (lock || !pausedRef.current) return;
    setSpot(null);
    pausedRef.current = false;
    void video.current?.play().catch(() => {});
  }, [lock]);

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
      {error ? <div className={styles.scanProblem}><TGcodeIcon size={44} /><p>{error}</p></div> : (
        <div ref={frame} className={styles.scanStage}>
          <video ref={video} playsInline muted className={ready ? styles.scanReady : undefined} />
          {!ready && <div className={styles.scanStarting}>Starting camera…</div>}
          <div className={`${styles.scanTarget} ${lock ? styles[`lock_${lock.tone}`] : styles.scanLive}`} style={lock && spot ? ringBox(spot, frame.current) : undefined} aria-hidden="true" />
          {lock && lock.tone !== 'busy' && (
            <span key={lock.tone} className={`${styles.scanLockIcon} ${styles[`lockIcon_${lock.tone}`]}`} style={spot ? iconBox(spot, frame.current) : undefined} aria-hidden="true">
              {lock.tone === 'ok' ? <Check size={44} strokeWidth={2.75} /> : lock.tone === 'warn' ? <TriangleAlert size={40} /> : <CircleAlert size={42} />}
            </span>
          )}
        </div>
      )}
      {lock && sheet && <div className={styles.scanSheet} role="status" aria-live="polite">{sheet}</div>}
      <footer className={styles.scanBottom} style={lock ? { display: 'none' } : undefined}>
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
