'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import jsQR from 'jsqr';
import Dialog, { DialogText } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import styles from './meetings.module.css';

// What a scan proves: the room QR holds this site's own address with a longer-lived key (…/portal/meetings/mine?m=<meeting>&k=<key>); a plain
// 6-digit number works too.
export type CheckInProof = { code: string } | { meeting_id: string; key: string };
export function proofFromScan(text: string): CheckInProof | null {
  const t = text.trim();
  if (/^\d{6}$/.test(t)) return { code: t };
  try {
    const u = new URL(t);
    if (u.origin !== window.location.origin || !u.pathname.startsWith('/portal/meetings')) return null;
    return proofFromParams(u.searchParams);
  } catch { return null; }
}
export function proofFromParams(sp: URLSearchParams): CheckInProof | null {
  const m = sp.get('m'), k = sp.get('k');
  return m && k && /^[0-9a-f-]{36}$/i.test(m) && /^[0-9a-f]{24}$/.test(k) ? { meeting_id: m, key: k } : null;
}

interface Caps { zoom?: { min: number; max: number; step: number }; torch?: boolean }
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A camera scanner with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Reads the QR and hands back the code; nothing is recorded or uploaded.
export default function QrScanner({ onScan, onClose, title = 'Scan A QR Code', note }: { onScan: (text: string) => boolean | void; onClose: () => void; title?: string; note?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<ZoomTrack | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Caps>({});
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const digital = !caps.zoom;
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const digitalRef = useRef(true);
  digitalRef.current = digital;

  useEffect(() => {
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
        const c = t.getCapabilities?.() as (Caps & { zoom?: { min: number; max: number; step: number } }) | undefined;
        if (c) setCaps({ zoom: c.zoom && c.zoom.max > c.zoom.min ? c.zoom : undefined, torch: !!c.torch });
        if (c?.zoom) setZoom(c.zoom.min);
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
            if (onScanRef.current(text) === true) { dead = true; stream?.getTracks().forEach((x) => x.stop()); }
          }
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setError((e as Error)?.name === 'NotAllowedError' ? 'The camera is blocked. Allow it in your browser settings, or type the code instead.' : 'Couldn’t open the camera. Type the code instead.');
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyZoom(v: number) {
    setZoom(v);
    if (caps.zoom) { try { await track.current?.applyConstraints({ advanced: [{ zoom: v }] }); } catch { /* keep going */ } }
  }
  async function toggleTorch() {
    const next = !torch;
    try { await track.current?.applyConstraints({ advanced: [{ torch: next }] }); setTorch(next); } catch { /* not supported after all */ }
  }
  const min = caps.zoom?.min ?? 1, max = caps.zoom ? Math.min(caps.zoom.max, 8) : 3;
  // Two fingers on the picture zoom it (a trackpad pinch, or ctrl + scroll, does the same on a computer).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startPinch = useRef<{ dist: number; zoom: number } | null>(null);
  const dist = () => { const [a, b] = [...pointers.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  const clampZoom = (v: number) => Math.max(min, Math.min(max, v));
  const pinch = {
    style: { touchAction: 'none' as const },
    onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.current.size === 2) startPinch.current = { dist: dist(), zoom }; },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2 && startPinch.current && startPinch.current.dist > 0) void applyZoom(clampZoom(startPinch.current.zoom * (dist() / startPinch.current.dist)));
    },
    onPointerUp: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); startPinch.current = null; },
    onPointerCancel: (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); startPinch.current = null; },
    onWheel: (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) void applyZoom(clampZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.93))); },
  };

  return (
    <Dialog title={title} onClose={onClose} wide>
      <DialogText>{note ?? 'Point the camera at the QR code. Zoom in if it is far away.'}</DialogText>
      {error ? <p className={styles.scanError}>{error}</p> : (
        <>
          <div className={styles.scanFrame} {...pinch}>
            <video ref={video} playsInline muted style={digital && zoom > 1 ? { transform: `scale(${zoom})` } : undefined} />
            <span className={styles.scanTarget} aria-hidden="true" />
            <span className={styles.scanZoom} aria-live="off">{zoom.toFixed(1)}×</span>
          </div>
          <div className={styles.scanTools}>
            <span className={styles.scanHint}>Pinch to zoom</span>
            {caps.torch && <Button type="button" size="sm" variant="secondary" onClick={() => void toggleTorch()}>{torch ? <ZapOff size={14} aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />} {torch ? 'Light Off' : 'Light On'}</Button>}
          </div>
        </>
      )}
    </Dialog>
  );
}
