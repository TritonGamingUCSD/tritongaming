'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CodeIcon from '@/components/portal/CodeIcon';
import { Check, CircleAlert, TriangleAlert, X, Zap } from 'lucide-react';
import { scanArea, inScanCircle, around } from '@/lib/qr/scanArea';
import type { FrameGeo, FrameRead } from '@/lib/qr/scanFrame';
import styles from './meetings.module.css';

interface Caps {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
}
type ZoomTrack = MediaStreamTrack & { getCapabilities?: () => Caps; applyConstraints: (c: unknown) => Promise<void> };

// A full-screen camera with zoom (the phone's own zoom where it has one, otherwise a digital zoom) and a flashlight where the phone offers it,
// for a QR on a screen across the room. Pinching only zooms, in and out of the middle of the picture; it never pans. Reads the QR and hands the
// text to the caller; nothing is recorded or uploaded.
// What a scan did, shown on the camera itself: the ring locks and takes the colour of the outcome, and `sheet` (the result) slides up over the frozen picture.
// Clearing `lock` carries on scanning with the same camera, so "Scan Next" is instant.
// Video pixels → where they show on the stage: the picture fills the stage with its middle kept ("cover"), then a digital zoom scales it about the middle.
function toStage(f: { x: number; y: number; r: number }, v: HTMLVideoElement, z: number): { x: number; y: number; r: number } | null {
  const stage = v.parentElement?.getBoundingClientRect();
  if (!stage || !v.videoWidth || !v.videoHeight) return null;
  const SW = stage.width,
    SH = stage.height,
    s = Math.max(SW / v.videoWidth, SH / v.videoHeight);
  const px = (SW - v.videoWidth * s) / 2 + f.x * s,
    py = (SH - v.videoHeight * s) / 2 + f.y * s;
  return { x: SW / 2 + (px - SW / 2) * z, y: SH / 2 + (py - SH / 2) * z, r: f.r * s * z };
}

// The ring and icon placed over the code: the code's own middle and size, kept inside the stage and never tiny or bigger than the screen.
function fit(spot: { x: number; y: number; r: number }, stage: HTMLElement | null) {
  const SW = stage?.clientWidth ?? 360,
    SH = stage?.clientHeight ?? 600;
  const r = Math.min(Math.max(spot.r * 1.08, 44), Math.min(SW, SH) * 0.46);
  return { x: Math.min(Math.max(spot.x, r * 0.5), SW - r * 0.5), y: Math.min(Math.max(spot.y, r * 0.5), SH - r * 0.5), r };
}
const ringBox = (spot: { x: number; y: number; r: number }, stage: HTMLElement | null): React.CSSProperties => {
  const f = fit(spot, stage);
  return { left: f.x, top: f.y, width: f.r * 2 };
};
const iconBox = (spot: { x: number; y: number; r: number }, stage: HTMLElement | null, byte = false): React.CSSProperties => {
  const f = fit(spot, stage);
  if (byte) return { left: f.x, top: f.y, width: f.r * 2.1, maxWidth: 'none' }; // Byte covers the code he came out of
  const d = Math.min(Math.max(f.r * 0.9, 56), 110);
  return { left: f.x, top: f.y, width: d, maxWidth: 'none' };
};

export type ScanLock = { tone: 'busy' | 'ok' | 'warn' | 'bad' };
export default function QrScanner({
  onScan,
  onClose,
  title = 'Scan A QR Code',
  note,
  footer,
  extra,
  lock,
  sheet,
  sheetKey,
}: {
  onScan: (text: string, how?: { bytecode: boolean }) => boolean | void; // `how`: which reader took it
  onClose: () => void;
  title?: string;
  note?: string;
  footer?: ReactNode;
  /** Sits in the row with the zoom and light buttons. */ extra?: ReactNode;
  lock?: ScanLock | null;
  sheet?: ReactNode;
  sheetKey?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const track = useRef<ZoomTrack | null>(null);
  const [error, setError] = useState('');
  const [caps, setCaps] = useState<Caps>({});
  const [torch, setTorch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  // Byte's pop-up is loaded after the camera starts (it is not needed to start scanning, and it carries Byte's drawing).
  const [Pop, setPop] = useState<ComponentType<{ className?: string; tilt?: number }> | null>(null);
  const [byteScan, setByteScan] = useState(false); // the code just taken was a Bytecode: Byte pops up on it instead of the check mark
  const [byteTilt, setByteTilt] = useState(0); // and how far it was turned from upright, in degrees: Byte grows out at that angle and turns upright as he jumps
  useEffect(() => {
    let alive = true;
    void import('@/components/Bytecode/ByteScanPop').then((m) => {
      if (alive) setPop(() => m.default);
    });
    return () => {
      alive = false;
    };
  }, []);
  const [spot, setSpot] = useState<{ x: number; y: number; r: number } | null>(null); // where on the screen the code was when it was read (stage pixels)   // the first picture is in and the zoom has settled: only then does the camera fade in
  // The result sheet's height follows its content smoothly (a spinner line becoming a result with a button), instead of jumping.
  const sheetBody = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState<number | null>(null);
  const sheetShown = !!(lock && sheet);
  // When the result goes away (Scan Next, Try Again) it slides out and the icon fades while the ring glides back, rather than vanishing at once.
  const lastShown = useRef<{ node: ReactNode; key?: string; tone: ScanLock['tone'] | null }>({ node: null, tone: null });
  if (lock) lastShown.current = { node: sheet ?? null, key: sheetKey, tone: lock.tone };
  const lastSpot = useRef<{ x: number; y: number; r: number } | null>(null);
  if (lock && spot) lastSpot.current = spot;
  const [leaving, setLeaving] = useState(false);
  const wasLocked = useRef(false);
  useEffect(() => {
    if (lock) {
      wasLocked.current = true;
      setLeaving(false);
      return;
    }
    if (!wasLocked.current) return;
    wasLocked.current = false;
    setLeaving(true);
    const id = window.setTimeout(() => setLeaving(false), 360);
    return () => window.clearTimeout(id);
  }, [lock]);
  useEffect(() => {
    const el = sheetBody.current;
    if (!sheetShown || !el) {
      setSheetH(null);
      return;
    }
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheetShown]);
  // Waiting for the camera (the phone may be asking for permission): say what is going on instead of looking stuck.
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => {
    if (ready) {
      setSlowStart(false);
      return;
    }
    const id = window.setTimeout(() => setSlowStart(true), 3500);
    return () => window.clearTimeout(id);
  }, [ready]);
  const seenRef = useRef({ text: '', at: -1e9 }); // the code last seen and when: the same one is not taken again while it stays in view
  const pausedRef = useRef(false); // a taken scan freezes the picture and stops reading until the caller clears `lock`
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  // The zoom lives in refs, not state: a pinch fires many times a second and re-rendering for each one is what made it lag.
  const zoomRef = useRef(1);
  const digitalRef = useRef(true);
  digitalRef.current = !caps.zoom;
  const capsRef = useRef<Caps>({});
  capsRef.current = caps;

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    // The page behind must not scroll or zoom while the camera is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let stream: MediaStream | null = null,
      raf = 0,
      dead = false,
      last = 0,
      stopWorker = () => {};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string; cornerPoints?: { x: number; y: number }[] }[]> };
      }
    ).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (dead) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const t = stream.getVideoTracks()[0] as ZoomTrack;
        track.current = t;
        const c = t.getCapabilities?.() as Caps | undefined;
        if (c) setCaps({ zoom: c.zoom && c.zoom.max > c.zoom.min ? c.zoom : undefined, torch: !!c.torch });
        if (c?.zoom) {
          zoomRef.current = Math.min(Math.max(c.zoom.min, 1), c.zoom.max);
          hw.current.want = zoomRef.current;
          hw.current.applied = -1;
          hw.current.shown = zoomRef.current;
          applyHardware();
          showZoom();
        } // start at 1×, not the ultra-wide the camera may open on
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
          const v0 = video.current;
          for (let i = 0; i < 20 && v0.readyState < 2 && !dead; i++) await new Promise((r) => setTimeout(r, 50));
          await new Promise((r) => setTimeout(r, 300)); // the phone's zoom (back to 1×) lands a moment after the first picture
          if (!dead) setReady(true);
        }
        // The reader runs in a worker where the browser allows one: the page keeps drawing while it works, one picture is out at a time and the next goes as soon as the answer is back. Where a
        // worker cannot be made (or fails to start) the same reader runs on the page itself, as it used to.
        let worker: Worker | null = null;
        try {
          worker = new Worker(new URL('../../../../lib/qr/scanWorker.ts', import.meta.url));
        } catch {
          worker = null;
        }
        let inflight: { id: number; at: number; v: HTMLVideoElement; z: number } | null = null;
        let jobs = 0;
        let local: ((data: Uint8ClampedArray, w: number, h: number, geo: FrameGeo) => FrameRead | null) | null = null;
        const loadLocal = () => {
          void import('@/lib/qr/scanFrame').then((m) => {
            local = m.readFrame;
          });
        };
        if (!worker) loadLocal();
        // What to do with a code that was read: the caller decides what the text is (true = taken, which freezes the picture; anything else = keep looking). The same code is not offered again
        // while it stays in view (after "Scan Next" or "Try Again" the code is usually still in front of the camera): it counts as new only once it has been out of sight for a moment, or
        // another code comes.
        const finish = (text: string, found: { x: number; y: number; r: number } | null, viaByte: boolean, v: HTMLVideoElement, z: number, now: number, angle = 0) => {
          const seen = seenRef.current;
          const repeat = text === seen.text && now - seen.at < 1500;
          seen.text = text;
          seen.at = now;
          if (!repeat && onScanRef.current(text, { bytecode: viaByte }) === true) {
            pausedRef.current = true;
            v.pause(); // freeze right away, so the ring lands where the code is in the frozen picture
            setByteScan(viaByte);
            setByteTilt(Math.round((angle * 180) / Math.PI));
            setSpot(found ? toStage(found, v, z) : null);
          }
        };
        if (worker) {
          worker.onmessage = (e: MessageEvent<{ id: number; out: FrameRead | null }>) => {
            const job = inflight;
            if (!job || e.data.id !== job.id) return;
            inflight = null;
            const out = e.data.out;
            if (out && !dead && !pausedRef.current) finish(out.text, out.found, out.viaByte, job.v, job.z, performance.now(), out.angle);
          };
          worker.onerror = () => {
            worker?.terminate();
            worker = null;
            inflight = null;
            loadLocal();
          };
        }
        stopWorker = () => worker?.terminate();
        const tick = async (now: number) => {
          raf = requestAnimationFrame(tick);
          const v = video.current;
          if (dead || pausedRef.current || zoomBusy.current || !v || v.readyState < 2 || now - last < (worker ? 70 : 140)) return; // (not while the zoom is moving: reading is the heavy part, and it would make the pinch stutter)
          if (worker && inflight) {
            if (now - inflight.at < 3000) return; // the last picture is still being read
            inflight = null; // (a worker that never answers does not stop the scanner)
          }
          last = now;
          // Only what is in (or very near) the circle on the screen is read, not the whole camera picture: another code at the edge of the view, or on a screen across the room, is never picked up by
          // accident. The picture is cropped to a square a little bigger than the circle (so a code that fills the circle still fits), which also gives a small code more pixels to be read from.
          const z = digitalRef.current ? zoomRef.current : 1;
          const stageEl = v.parentElement;
          const area = scanArea(
            { w: v.videoWidth, h: v.videoHeight },
            { w: stageEl?.clientWidth ?? v.videoWidth, h: stageEl?.clientHeight ?? v.videoHeight },
            { w: window.innerWidth, h: window.innerHeight },
            z,
          );
          const { cx, cy, side: L } = area;
          if (detector && z === 1) {
            try {
              const hit = (await detector.detect(v))[0];
              if (hit) {
                const f = around(hit.cornerPoints ?? []);
                if (inScanCircle(area, f)) {
                  finish(hit.rawValue, f, false, v, z, now);
                  return;
                }
              }
            } catch {
              /* fall back below */
            }
          }
          if (!ctx) return;
          canvas.width = Math.min(720, Math.round(L));
          canvas.height = canvas.width;
          ctx.drawImage(v, cx - L / 2, cy - L / 2, L, L, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const k = L / canvas.width; // the picture it reads is the square in the middle, scaled to fit
          const geo: FrameGeo = { area, k, ox: cx - L / 2, oy: cy - L / 2 };
          if (worker) {
            const id = ++jobs;
            inflight = { id, at: now, v, z };
            worker.postMessage({ id, data: img.data, w: img.width, h: img.height, geo }, [img.data.buffer]);
            return;
          }
          const out = local?.(img.data, img.width, img.height, geo);
          if (out) finish(out.text, out.found, out.viaByte, v, z, now, out.angle);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const insecure = typeof window !== 'undefined' && !window.isSecureContext; // a phone only lets a page use its camera over https
        setError(
          insecure
            ? 'This page isn’t on a secure (https) connection, so the phone won’t let it use the camera. Type the code below instead.'
            : (e as Error)?.name === 'NotAllowedError'
              ? 'The camera is blocked. Allow it in your browser’s settings, or type the code below instead.'
              : 'Couldn’t open the camera. Type the code below instead.',
        );
      }
    })();
    return () => {
      dead = true;
      stopWorker();
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    if (lock || !pausedRef.current) return;
    setSpot(null);
    seenRef.current.at = performance.now(); // the camera starts again with the same code probably still in front of it: that one does not count as a new scan
    pausedRef.current = false;
    void video.current?.play().catch(() => {});
  }, [lock]);

  // The phone's own zoom takes one request at a time: while one is being applied, only the newest wanted value waits behind it.
  // How zoom stays smooth: while fingers (or the wheel) move, ONLY the picture's scale changes (a transform the phone's graphics chip does, nothing else runs: the code reading waits).
  // Once the movement stops, a phone with its own zoom is asked for that value (one request at a time) and, when its pictures have caught up, the scale goes back to 1 and reading
  // carries on. A phone without its own zoom keeps the scale as the zoom.
  const hw = useRef({ busy: false, want: 1, applied: 1, shown: 1 }); // shown: the zoom the camera's pictures really have
  const zoomBusy = useRef(false); // reading waits while the zoom is moving or settling
  const gestureOn = useRef(false); // two fingers are down
  const settleT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function finishHardware() {
    window.setTimeout(() => {
      const h = hw.current;
      if (gestureOn.current || Math.abs(zoomRef.current - h.applied) > 0.001) return; // moved again meanwhile: the next settle handles it
      h.shown = h.applied;
      if (video.current) video.current.style.transform = '';
      zoomBusy.current = false;
    }, 200); // the camera's pictures take a moment to show the new zoom: removing the scale sooner would flash the old one
  }
  function applyHardware() {
    const h = hw.current;
    if (h.busy || !track.current) return;
    if (h.want === h.applied) {
      finishHardware();
      return;
    }
    h.busy = true;
    h.applied = h.want;
    track.current
      .applyConstraints({ advanced: [{ zoom: h.want }] })
      .catch(() => {
        /* keep going */
      })
      .finally(() => {
        h.busy = false;
        if (h.want !== h.applied) applyHardware();
        else finishHardware();
      });
  }
  // Called whenever the wanted zoom changes: after a short stillness (and never with fingers down) it is made real.
  function afterZoom() {
    zoomBusy.current = true;
    clearTimeout(settleT.current);
    settleT.current = setTimeout(() => {
      if (gestureOn.current) return;
      if (digitalRef.current) {
        zoomBusy.current = false;
        return;
      }
      if (Math.abs(zoomRef.current - hw.current.shown) < 0.001 && !hw.current.busy) {
        if (video.current) video.current.style.transform = '';
        zoomBusy.current = false;
        return;
      }
      hw.current.want = zoomRef.current;
      applyHardware();
    }, 140);
  }
  // Zoom: pinch with two fingers (or ctrl + scroll / pinch on a trackpad, or the wheel). The phone's own zoom where it has one, otherwise a digital zoom of the middle of the picture.
  // Nothing here re-renders the screen: the picture's scale and the little "1.7×" readout are written straight to the page.
  const readout = useRef<HTMLButtonElement>(null);
  const limits = () => {
    const z = capsRef.current.zoom;
    return { min: z?.min ?? 1, max: z ? Math.min(z.max, 8) : 4 };
  };
  const showZoom = () => {
    const el = readout.current;
    if (!el) return;
    const z = zoomRef.current,
      t = `${z < 1 ? Number(z.toFixed(1)).toString().replace(/^0/, '') : Number(z.toFixed(1))}×`;
    if (el.textContent !== t) el.textContent = t;
    el.setAttribute('aria-label', `Zoom ${t.replace('×', ' times')}. Tap to reset`);
  };
  const paint = useRef(0);
  function setZoomTo(v: number) {
    const { min, max } = limits();
    zoomRef.current = Math.max(min, Math.min(max, v));
    afterZoom();
    if (paint.current) return; // one paint per frame, whatever the number of touch events
    paint.current = requestAnimationFrame(() => {
      paint.current = 0;
      showZoom();
      const scale = digitalRef.current ? zoomRef.current : zoomRef.current / hw.current.shown;
      if (video.current) video.current.style.transform = Math.abs(scale - 1) > 0.001 ? `translate3d(0, 0, 0) scale(${scale})` : '';
    });
  }
  async function toggleTorch() {
    const next = !torch;
    try {
      await track.current?.applyConstraints({ advanced: [{ torch: next }] });
      setTorch(next);
    } catch {
      /* not supported after all */
    }
  }
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    const types = ['gesturestart', 'gesturechange', 'gestureend', 'touchmove'];
    types.forEach((t) => el.addEventListener(t, stop, { passive: false }));
    // Pinch: two pointers on the picture; the zoom follows how far apart they are, from where it was when the second finger came down.
    const pts = new Map<number, { x: number; y: number }>();
    let start: { d: number; z: number } | null = null;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* fine */
      }
      if (pts.size === 2) {
        start = { d: Math.max(dist(), 1), z: zoomRef.current };
        gestureOn.current = true;
        zoomBusy.current = true;
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && start) {
        e.preventDefault();
        setZoomTo(start.z * (dist() / start.d));
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      start = pts.size === 2 ? { d: Math.max(dist(), 1), z: zoomRef.current } : null;
      if (pts.size < 2 && gestureOn.current) {
        gestureOn.current = false;
        afterZoom();
      }
    };
    // A trackpad pinch (and ctrl + scroll) arrives as a wheel event with ctrlKey set; a plain scroll wheel zooms too. Without preventDefault the browser would zoom the page.
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoomTo(zoomRef.current * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      types.forEach((t) => el.removeEventListener(t, stop));
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps
  // The dimmed layer round the circle follows the ring (it is moved and scaled, which the phone can do without repainting the screen), so the dimming always hugs the ring.
  function dimStyle(): React.CSSProperties | undefined {
    if (!lock) return undefined;
    const st = frame.current,
      SW = st?.clientWidth ?? 360,
      SH = st?.clientHeight ?? 600;
    const guide = Math.min(0.72 * window.innerWidth, 0.52 * window.innerHeight);
    let x = SW / 2,
      y = SH * 0.31,
      d = Math.min(0.46 * window.innerWidth, 0.28 * window.innerHeight);
    if (spot) {
      const f = fit(spot, st);
      x = f.x;
      y = f.y;
      d = f.r * 2;
    }
    return { transform: `translate(calc(-50% + ${(x - SW / 2).toFixed(1)}px), calc(-50% + ${(y - SH / 2).toFixed(1)}px)) scale(${(d / guide).toFixed(4)})` };
  }

  if (!mounted) return null;
  // Portaled to the page itself: the portal's panels are animated with a transform, which would otherwise shrink a "fixed" overlay to the panel.
  return createPortal(
    <div className={styles.scanScreen} role="dialog" aria-modal="true" aria-label={title}>
      <header className={styles.scanTop}>
        <span className={styles.scanTitle}>{title}</span>
        <button type="button" className={styles.scanClose} onClick={onClose} aria-label="Close scanner">
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      {error ? (
        <div className={styles.scanProblem}>
          <CodeIcon size={44} />
          <p>{error}</p>
        </div>
      ) : (
        <div ref={frame} className={styles.scanStage}>
          <video ref={video} playsInline muted className={ready ? styles.scanReady : undefined} />
          {!ready && (
            <div className={styles.scanStarting} role="status">
              <span className={styles.scanStartSpin} aria-hidden="true" />
              Starting camera…{slowStart && <small>If your phone asks, allow the camera. Or type the code below.</small>}
            </div>
          )}
          <div className={styles.scanDim} style={dimStyle()} aria-hidden="true" />
          <div className={`${styles.scanDimLock} ${lock ? styles.scanDimOn : ''}`} aria-hidden="true" />
          <div
            className={`${styles.scanTarget} ${lock ? styles[`lock_${lock.tone}`] : styles.scanLive}`}
            style={lock && spot ? ringBox(spot, frame.current) : undefined}
            aria-hidden="true"
          />
          {(lock ? lock.tone : leaving ? lastShown.current.tone : null) &&
            (lock ? lock.tone : lastShown.current.tone) !== 'busy' &&
            (() => {
              const tone = (lock ? lock.tone : lastShown.current.tone)!;
              return (
                <span
                  key={tone}
                  className={`${styles.scanLockIcon} ${tone === 'ok' && Pop && byteScan ? styles.lockIcon_byte : styles[`lockIcon_${tone}`]} ${lock ? '' : styles.scanLockIconOut}`}
                  style={(lock ? spot : lastSpot.current) ? iconBox((lock ? spot : lastSpot.current)!, frame.current, tone === 'ok' && !!Pop && byteScan) : undefined}
                  aria-hidden="true"
                >
                  {tone === 'ok' ? (
                    Pop && byteScan ? (
                      <Pop tilt={byteTilt} />
                    ) : (
                      <Check size={44} strokeWidth={2.75} />
                    )
                  ) : tone === 'warn' ? (
                    <TriangleAlert size={40} />
                  ) : (
                    <CircleAlert size={42} />
                  )}
                </span>
              );
            })()}
        </div>
      )}
      {(sheetShown || (leaving && lastShown.current.node)) && (
        <div className={`${styles.scanSheet} ${sheetShown ? '' : styles.scanSheetOut}`} style={sheetH ? { height: sheetH } : undefined} role="status" aria-live="polite">
          <div ref={sheetBody} className={styles.scanSheetBody}>
            <div key={sheetShown ? sheetKey : lastShown.current.key} className={styles.scanSheetFade}>
              {sheetShown ? sheet : lastShown.current.node}
            </div>
          </div>
        </div>
      )}
      <footer className={`${styles.scanBottom} ${lock ? styles.scanBottomOff : ''}`} aria-hidden={lock ? true : undefined}>
        <p className={styles.scanHint}>{note ?? 'Point the camera at the QR code.'}</p>
        <div className={styles.scanRow}>
          <button ref={readout} type="button" className={styles.scanTool} onClick={() => setZoomTo(Math.abs(zoomRef.current - 1) < 0.05 ? 2 : 1)}>
            1×
          </button>
          {caps.torch && (
            <button
              type="button"
              className={`${styles.scanLight} ${torch ? styles.scanLightOn : ''}`}
              onClick={() => void toggleTorch()}
              aria-pressed={torch}
              aria-label={torch ? 'Turn the light off' : 'Turn the light on'}
              title={torch ? 'Light off' : 'Light on'}
            >
              <Zap size={20} strokeWidth={2.2} fill={torch ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          )}
          {extra}
        </div>
        {footer}
      </footer>
    </div>,
    document.body,
  );
}
