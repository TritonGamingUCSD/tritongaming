'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, ZapOff } from 'lucide-react';
import jsQR from 'jsqr';
import Dialog, { DialogText } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import styles from './meetings.module.css';

// The room QR holds this site's own address with the code on the end (…/portal/meetings/mine?code=123456). A plain 6-digit number works too.
export function codeFromScan(text: string): string | null {
  const t = text.trim();
  if (/^\d{6}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (u.origin !== window.location.origin || !u.pathname.startsWith('/portal/meetings')) return null;
    const c = u.searchParams.get('code');
    return c && /^\d{6}$/.test(c) ? c : null;
  } catch { return null; }
}

interface Caps { zoom?: { min: number; max: number; step: number }; torch?: boolean }
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A camera scanner with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Reads the QR and hands back the code; nothing is recorded or uploaded.
export default function QrScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<ZoomTrack | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Caps>({});
  const [zoom, setZoom] = useState(1);
  const [torch, setTorch] = useState(false);
  const digital = !caps.zoom;
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const digitalRef = useRef(true);
  digitalRef.current = digital;

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0, dead = false, last = 0;
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
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
          }
          const code = text ? codeFromScan(text) : null;
          if (code) { dead = true; stream?.getTracks().forEach((x) => x.stop()); onCode(code); }
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
  const min = caps.zoom?.min ?? 1, max = caps.zoom ? Math.min(caps.zoom.max, 8) : 3, step = caps.zoom?.step || 0.1;

  return (
    <Dialog title="Scan The Check-In QR" onClose={onClose}>
      <DialogText>Point the camera at the QR on the screen. Zoom in if it is far away.</DialogText>
      {error ? <p className={styles.scanError}>{error}</p> : (
        <>
          <div className={styles.scanFrame}>
            <video ref={video} playsInline muted style={digital && zoom > 1 ? { transform: `scale(${zoom})` } : undefined} />
            <span className={styles.scanTarget} aria-hidden="true" />
          </div>
          <div className={styles.scanTools}>
            <label>Zoom<input type="range" min={min} max={max} step={step} value={zoom} onChange={(e) => void applyZoom(Number(e.target.value))} aria-label="Zoom" /></label>
            {caps.torch && <Button type="button" size="sm" variant="secondary" onClick={() => void toggleTorch()}>{torch ? <ZapOff size={14} aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />} {torch ? 'Light Off' : 'Light On'}</Button>}
          </div>
        </>
      )}
    </Dialog>
  );
}
