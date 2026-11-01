'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minus, Plus, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { FILTER_CSS, SHOTS, cellRatio, cellSize, promptFor, type Overlay } from '@/lib/photobooth/booth';
import { composePicture, cutShot, loadImage, type PlacedSticker } from '@/lib/photobooth/compose';
import { BoothSounds } from '@/lib/photobooth/sounds';
import { call, type BoothData } from './api';
import { QrScreen } from './QrScreen';
import { StickerLayer, type Placed } from './StickerLayer';
import { useCamera } from './useCamera';
import styles from './photobooth.module.css';

type Phase = 'idle' | 'choose' | 'shoot' | 'review' | 'saving' | 'qr';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEG = Math.PI / 12; // one turn of a sticker: 15 degrees

// A booth itself, on the whole screen: a welcome screen, the guest picks a frame and stickers on the live camera, the countdown and shots, a look at the picture (retake or keep), then the QR code to download it.
export function BoothRun({ booth, onExit }: { booth: string; onExit: () => void }) {
  const [data, setData] = useState<BoothData | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [frameId, setFrameId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [shotNo, setShotNo] = useState(0);
  const [flash, setFlash] = useState(false);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [token, setToken] = useState('');
  const camera = useCamera();
  const images = useRef(new Map<string, HTMLImageElement>());
  const sounds = useRef<BoothSounds | null>(null);
  const run = useRef(0); // a number for each go at the shots: leaving or cancelling makes the running one stop
  const keys = useRef(0);

  useEffect(() => {
    void (async () => {
      const r = await call<BoothData>(`/api/photobooth/booths/${booth}`);
      if (!r.ok) return setError(r.error);
      setData(r.data);
      sounds.current = new BoothSounds(r.data.config.sounds);
      for (const o of r.data.overlays)
        loadImage(o.image)
          .then((img) => images.current.set(o.id, img))
          .catch(() => undefined);
    })();
    const stop = run;
    const audio = sounds;
    return () => {
      stop.current++;
      audio.current?.close();
    };
  }, [booth]);

  useEffect(() => {
    const url = picture?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picture]);

  const config = data?.config;
  const frames = useMemo(() => (data?.overlays ?? []).filter((o) => o.kind === 'frame'), [data]);
  const stickerChoices = useMemo(() => (data?.overlays ?? []).filter((o) => o.kind === 'sticker'), [data]);
  const frame = frames.find((f) => f.id === frameId) ?? null;
  const chosen = stickers.find((s) => s.key === selected) ?? null;

  const reset = useCallback(() => {
    run.current++;
    setPhase('idle');
    setStickers([]);
    setSelected(null);
    setFrameId(null);
    setPicture(null);
    setToken('');
    setCount(null);
    setPrompt('');
    setShotNo(0);
  }, []);

  const addSticker = (o: Overlay) => {
    const s: Placed = { key: ++keys.current, overlay: o, x: o.x, y: o.y, size: o.size, rotation: 0 };
    setStickers((l) => [...l, s]);
    setSelected(s.key);
  };
  const patch = (key: number, f: (s: Placed) => Placed) => setStickers((l) => l.map((s) => (s.key === key ? f(s) : s)));

  async function shoot() {
    if (!config || !camera.video.current) return;
    const mine = ++run.current;
    const alive = () => run.current === mine;
    const { w, h } = cellSize(config.aspect);
    const shots: HTMLCanvasElement[] = [];
    setPhase('shoot');
    setSelected(null);
    for (let i = 0; i < SHOTS[config.layout]; i++) {
      setShotNo(i + 1);
      setPrompt(promptFor(config.prompts, i));
      for (let c = config.countdown; c >= 1; c--) {
        if (!alive()) return;
        setCount(c);
        sounds.current?.beep();
        await wait(1000);
      }
      if (!alive()) return;
      setCount(null);
      sounds.current?.shutter();
      if (config.flash) {
        setFlash(true);
        setTimeout(() => setFlash(false), 180);
      }
      shots.push(cutShot(camera.video.current, w, h, config.mirror));
      await wait(900);
    }
    if (!alive()) return;
    setPrompt('');
    try {
      const placed: PlacedSticker[] = stickers.flatMap((s) => {
        const image = images.current.get(s.overlay.id);
        return image ? [{ image, x: s.x, y: s.y, size: s.size, rotation: s.rotation }] : [];
      });
      const blob = await composePicture({ config, shots, stickers: placed, frame: frame ? (images.current.get(frame.id) ?? null) : null });
      if (!alive()) return;
      setPicture({ blob, url: URL.createObjectURL(blob) });
      setPhase('review');
    } catch {
      setError('The picture could not be made. Try again.');
      reset();
    }
  }

  async function keep() {
    if (!picture) return;
    setPhase('saving');
    const form = new FormData();
    form.append('booth', booth);
    form.append('file', new File([picture.blob], 'photo.jpg', { type: 'image/jpeg' }));
    const res = await fetch('/api/photobooth/photos', { method: 'POST', body: form, cache: 'no-store' }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (res?.ok && json.token) {
      setToken(json.token);
      setPhase('qr');
    } else {
      setError(json.error ?? 'The picture could not be saved. Check the connection and try again.');
      setPhase('review');
    }
  }

  const start = () => {
    sounds.current?.unlock();
    setError('');
    if (frames.length || stickerChoices.length) setPhase('choose');
    else void shoot();
  };

  const ratio = config ? cellRatio(config.aspect) : 0.75;
  const showCam = phase === 'idle' || phase === 'choose' || phase === 'shoot';
  const stage = (
    <div className={styles.stage} style={{ ['--accent' as string]: config?.accent ?? '#facc15', ['--ratio' as string]: ratio }}>
      <button type="button" className={styles.exit} onClick={onExit} aria-label="Leave the booth">
        <X size={18} aria-hidden="true" /> Exit
      </button>
      <button
        type="button"
        className={`${styles.exit} ${styles.full}`}
        onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
        aria-label="Full screen"
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>

      {!data || !config ? (
        error ? (
          <div className={styles.center}>
            <Notice tone="error">{error}</Notice>
          </div>
        ) : (
          <Loading label="Opening the booth…" />
        )
      ) : (
        <>
          {/* the camera stays on behind everything so the next guest starts at once */}
          <div className={`${styles.cam} ${showCam ? '' : styles.camHidden}`}>
            <video
              ref={camera.video}
              playsInline
              muted
              className={styles.video}
              style={{ transform: config.mirror ? 'scaleX(-1)' : undefined, filter: FILTER_CSS[config.filter] }}
            />
            {frame && showCam && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.camFrame} src={frame.image} alt="" />
            )}
            {showCam && phase !== 'idle' && (
              <StickerLayer stickers={stickers} selected={selected} locked={phase === 'shoot'} onSelect={setSelected} onMove={(k, x, y) => patch(k, (s) => ({ ...s, x, y }))} />
            )}
            {phase === 'idle' && <div className={styles.dim} />}
            {phase === 'shoot' && count !== null && (
              <div className={styles.count} key={`${shotNo}-${count}`} aria-live="assertive">
                {count}
              </div>
            )}
            {flash && <div className={styles.flash} />}
          </div>

          {camera.error && (
            <div className={styles.center}>
              <Notice tone="error">{camera.error}</Notice>
              <button type="button" className={styles.bigBtn} onClick={() => void camera.retry()}>
                Try Again
              </button>
            </div>
          )}

          {phase === 'idle' && !camera.error && (
            <div className={styles.welcome}>
              <h1>{config.welcome_title}</h1>
              {config.welcome_text && <p>{config.welcome_text}</p>}
              <button type="button" className={styles.bigBtn} onClick={start} disabled={!camera.ready}>
                {camera.ready ? 'Start' : 'Starting Camera…'}
              </button>
              {error && <p className={styles.problem}>{error}</p>}
            </div>
          )}

          {phase === 'choose' && (
            <div className={styles.panel}>
              {frames.length > 0 && (
                <div className={styles.chips} role="radiogroup" aria-label="Frame">
                  <span className={styles.chipLabel}>Frame</span>
                  <button type="button" className={`${styles.chip} ${frameId === null ? styles.chipOn : ''}`} onClick={() => setFrameId(null)}>
                    None
                  </button>
                  {frames.map((f) => (
                    <button key={f.id} type="button" className={`${styles.chip} ${frameId === f.id ? styles.chipOn : ''}`} onClick={() => setFrameId(f.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.image} alt="" /> {f.name}
                    </button>
                  ))}
                </div>
              )}
              {stickerChoices.length > 0 && (
                <div className={styles.chips} aria-label="Stickers">
                  <span className={styles.chipLabel}>Stickers</span>
                  {stickerChoices.map((s) => (
                    <button key={s.id} type="button" className={styles.chip} onClick={() => addSticker(s)} aria-label={`Add ${s.name}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.image} alt="" /> {s.name}
                    </button>
                  ))}
                </div>
              )}
              {chosen && (
                <div className={styles.chips} aria-label="Selected sticker">
                  <span className={styles.chipLabel}>{chosen.overlay.name}</span>
                  {chosen.overlay.can_resize && (
                    <>
                      <button type="button" className={styles.chip} onClick={() => patch(chosen.key, (s) => ({ ...s, size: Math.max(0.05, s.size / 1.2) }))} aria-label="Smaller">
                        <Minus size={18} aria-hidden="true" />
                      </button>
                      <button type="button" className={styles.chip} onClick={() => patch(chosen.key, (s) => ({ ...s, size: Math.min(1, s.size * 1.2) }))} aria-label="Bigger">
                        <Plus size={18} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  {chosen.overlay.can_rotate && (
                    <>
                      <button type="button" className={styles.chip} onClick={() => patch(chosen.key, (s) => ({ ...s, rotation: s.rotation - DEG }))} aria-label="Turn left">
                        <RotateCcw size={18} aria-hidden="true" />
                      </button>
                      <button type="button" className={styles.chip} onClick={() => patch(chosen.key, (s) => ({ ...s, rotation: s.rotation + DEG }))} aria-label="Turn right">
                        <RotateCw size={18} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => {
                      setStickers((l) => l.filter((s) => s.key !== chosen.key));
                      setSelected(null);
                    }}
                    aria-label="Remove the sticker"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className={styles.btnRow}>
                <button type="button" className={styles.ghostBtn} onClick={reset}>
                  Cancel
                </button>
                <button type="button" className={styles.bigBtn} onClick={() => void shoot()}>
                  Take The Photos
                </button>
              </div>
            </div>
          )}

          {phase === 'shoot' && (
            <div className={styles.shootBar}>
              <span className={styles.shotNo}>
                Photo {shotNo} of {SHOTS[config.layout]}
              </span>
              {prompt && <span className={styles.prompt}>{prompt}</span>}
              <button type="button" className={styles.ghostBtn} onClick={reset}>
                Cancel
              </button>
            </div>
          )}

          {(phase === 'review' || phase === 'saving') && picture && (
            <div className={styles.review}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.reviewImg} src={picture.url} alt="Your picture" />
              <div className={styles.reviewSide}>
                <h2 className={styles.qrTitle}>How Does It Look?</h2>
                {error && <p className={styles.problem}>{error}</p>}
                <button type="button" className={styles.bigBtn} onClick={() => void keep()} disabled={phase === 'saving'}>
                  {phase === 'saving' ? 'Saving…' : 'Looks Great!'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={() => (setError(''), void shoot())} disabled={phase === 'saving'}>
                  Retake
                </button>
              </div>
            </div>
          )}

          {phase === 'qr' && picture && token && <QrScreen token={token} picture={picture.url} seconds={config.qr_seconds} onDone={reset} />}
        </>
      )}
    </div>
  );
  return typeof document === 'undefined' ? null : createPortal(stage, document.body);
}
