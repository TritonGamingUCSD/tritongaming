'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minus, Plus, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { PhotoWall, type WallPhoto } from '@/components/PhotoWall/PhotoWall';
import { FILTER_CSS, SHOTS, cellRatio, cellSize, promptFor, type Overlay } from '@/lib/photobooth/booth';
import { composeFrame, composePicture, composeStripFrame, cutShot, loadImage, type PlacedSticker } from '@/lib/photobooth/compose';
import { GIF_TRIES, MAX_GIF_BYTES, encodeGif, spread } from '@/lib/photobooth/gif';
import { BoothSounds } from '@/lib/photobooth/sounds';
import { call, type BoothData } from './api';
import { CameraMenu } from './CameraMenu';
import { ClipPlayer } from './ClipPlayer';
import { QrScreen } from './QrScreen';
import { StickerLayer, type Placed } from './StickerLayer';
import { useCamera } from './useCamera';
import styles from './photobooth.module.css';

type Phase = 'idle' | 'choose' | 'shoot' | 'review' | 'saving' | 'qr';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DEG = Math.PI / 12; // one turn of a sticker: 15 degrees
const THUMB_W = 180;
// A live clip around each shot: the camera is sampled all the time, the last 1.5 seconds before the shutter are kept, and half a second after it.
const FRAME_MS = 125;
const BEFORE = 12;
const AFTER = 4;
const CLIP_W = 320;
const CLIP_PLAY_W = 480;

/** A small picture of one shot, for the film strip beside the camera and the Retake buttons. */
const thumbOf = (shot: HTMLCanvasElement): string => {
  const c = document.createElement('canvas');
  c.width = THUMB_W;
  c.height = Math.round((THUMB_W * shot.height) / shot.width);
  c.getContext('2d')!.drawImage(shot, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
};

/** True when the keys being typed belong to a box (so the booth's own keys stay out of the way). */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

// A booth itself, on the whole screen: a welcome screen (with the guests' shared pictures drifting by), the booth's frame on the live camera, the countdown and the shots (each flies into a film strip), a look at the picture where any one
// shot can be retaken, then the QR code to download it (and the animated picture and the gallery choice are on the guest's page). Enter, Space or a clicker's page key does the main button of each step.
export function BoothRun({ booth, test = false, onExit }: { booth: string; test?: boolean; onExit: () => void }) {
  const [data, setData] = useState<BoothData | null>(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [stickers, setStickers] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [shotNo, setShotNo] = useState(0);
  const [flash, setFlash] = useState(false);
  const [making, setMaking] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [moving, setMoving] = useState<{ blob: Blob; url: string } | null>(null); // the animated strip
  const [playing, setPlaying] = useState<HTMLCanvasElement[][]>([]); // the finished frames of each shot's clip, for the big player
  const [token, setToken] = useState('');
  const [wall, setWall] = useState<WallPhoto[]>([]); // every picture in the booth's gallery, drifting behind the welcome screen
  const camera = useCamera();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0); // (a portal needs the page: not drawn on the server)
    return () => window.clearTimeout(t);
  }, []);
  const images = useRef(new Map<string, HTMLImageElement>());
  const shots = useRef<HTMLCanvasElement[]>([]);
  const clips = useRef<HTMLCanvasElement[][]>([]); // each shot's raw clip frames (BEFORE + AFTER of them)
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
      if (r.data.frame.image)
        loadImage(r.data.frame.image)
          .then((img) => images.current.set('frame', img))
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
  useEffect(() => {
    const url = moving?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [moving]);

  // The welcome screen shows every picture of the booth's gallery; it looks again now and then, so new ones join in.
  const galleryToken = data?.booth.gallery_token;
  useEffect(() => {
    if (!galleryToken || test || phase !== 'idle') return;
    let live = true;
    const load = async () => {
      const r = await call<{ photos: WallPhoto[] }>(`/api/gallery/${galleryToken}`);
      if (live && r.ok) setWall(r.data.photos);
    };
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [galleryToken, test, phase]);

  const config = data?.config;
  const stickerChoices = useMemo(() => data?.overlays ?? [], [data]);
  const frameUrl = data?.frame.image ?? '';
  const guestPicks = !!config?.guest_stickers;
  // With the sticker step skipped, every sticker of the booth is on every picture where the host placed it.
  const onPicture: Placed[] = useMemo(
    () => (guestPicks ? stickers : stickerChoices.map((o, i) => ({ key: -1 - i, overlay: o, x: o.x, y: o.y, size: o.size, rotation: 0 }))),
    [guestPicks, stickers, stickerChoices],
  );
  const chosen = stickers.find((s) => s.key === selected) ?? null;

  const reset = useCallback(() => {
    run.current++;
    shots.current = [];
    clips.current = [];
    setMoving(null);
    setPlaying([]);
    setPhase('idle');
    setStickers([]);
    setSelected(null);
    setPicture(null);
    setToken('');
    setCount(null);
    setPrompt('');
    setShotNo(0);
    setThumbs([]);
    setMaking(false);
  }, []);

  const addSticker = (o: Overlay) => {
    const s: Placed = { key: ++keys.current, overlay: o, x: o.x, y: o.y, size: o.size, rotation: 0 };
    setStickers((l) => [...l, s]);
    setSelected(s.key);
  };
  const patch = (key: number, f: (s: Placed) => Placed) => setStickers((l) => l.map((s) => (s.key === key ? f(s) : s)));

  const placed = (): PlacedSticker[] =>
    onPicture.flatMap((s) => {
      const image = images.current.get(s.overlay.id);
      return image ? [{ image, x: s.x, y: s.y, size: s.size, rotation: s.rotation }] : [];
    });

  /** Counts down and takes one photo, with the clip around it (null when the booth was left or cancelled meanwhile). */
  async function takeShot(i: number, alive: () => boolean): Promise<{ shot: HTMLCanvasElement; clip: HTMLCanvasElement[] } | null> {
    if (!config || !camera.video.current) return null;
    const video = camera.video.current;
    const { w, h } = cellSize(config.aspect);
    setShotNo(i + 1);
    setPrompt(promptFor(config.prompts, i));
    // the camera is watched all through the countdown, keeping only the latest moments
    const before: HTMLCanvasElement[] = [];
    let after: HTMLCanvasElement[] | null = null;
    const sampler = window.setInterval(() => {
      const f = cutShot(video, CLIP_W, Math.round((CLIP_W * h) / w), config.mirror);
      if (after) {
        if (after.length < AFTER) after.push(f);
      } else {
        before.push(f);
        if (before.length > BEFORE) before.shift();
      }
    }, FRAME_MS);
    try {
      for (let c = config.countdown; c >= 1; c--) {
        if (!alive()) return null;
        setCount(c);
        sounds.current?.beep();
        await wait(1000);
      }
      if (!alive()) return null;
      setCount(null);
      sounds.current?.shutter();
      if (config.flash) {
        setFlash(true);
        setTimeout(() => setFlash(false), 180);
      }
      const shot = cutShot(video, w, h, config.mirror);
      after = [];
      await wait(900);
      const clip = [...before, ...after];
      // (a short countdown has fewer moments: the first one is held so every clip is as long as the others)
      while (clip.length < BEFORE + AFTER) clip.unshift(clip[0] ?? shot);
      return { shot, clip };
    } finally {
      window.clearInterval(sampler);
    }
  }

  /** Puts the finished picture together from the shots and goes to the review. */
  async function build(alive: () => boolean) {
    if (!config) return;
    setPrompt('');
    setMaking(true);
    try {
      const blob = await composePicture({ config, shots: shots.current, stickers: placed(), frame: frameUrl ? (images.current.get('frame') ?? null) : null });
      if (!alive()) return;
      const still = { blob, url: URL.createObjectURL(blob) };
      const strip = await movingStrip();
      if (!alive()) {
        URL.revokeObjectURL(still.url);
        return;
      }
      setPicture(still);
      setMoving(strip.gif ? { blob: strip.gif, url: URL.createObjectURL(strip.gif) } : null);
      setPlaying(strip.played);
      setThumbs(shots.current.map(thumbOf));
      setMaking(false);
      setPhase('review');
    } catch {
      setError('The picture could not be made. Try again.');
      reset();
    }
  }

  async function shoot() {
    if (!config || !camera.video.current) return;
    const mine = ++run.current;
    const alive = () => run.current === mine;
    shots.current = [];
    clips.current = [];
    setThumbs([]);
    setPhase('shoot');
    setSelected(null);
    for (let i = 0; i < SHOTS[config.layout]; i++) {
      const got = await takeShot(i, alive);
      if (!got) return;
      shots.current.push(got.shot);
      clips.current.push(got.clip);
      setThumbs((t) => [...t, thumbOf(got.shot)]);
    }
    if (alive()) await build(alive);
  }

  /** Takes one photo again (the guest tapped Retake under it) and puts the picture together again. */
  async function retakeOne(i: number) {
    if (!config || !camera.video.current) return;
    const mine = ++run.current;
    const alive = () => run.current === mine;
    setPhase('shoot');
    const got = await takeShot(i, alive);
    if (!got) return;
    shots.current[i] = got.shot;
    clips.current[i] = got.clip;
    setThumbs(shots.current.map(thumbOf));
    if (alive()) await build(alive);
  }

  /** The animated strip (the whole strip with every photo playing its own clip at once, as small as it needs to be; null if it cannot be made: the picture is still kept) and the finished frames of each clip for the big player. */
  async function movingStrip(): Promise<{ gif: Blob | null; played: HTMLCanvasElement[][] }> {
    if (!config) return { gif: null, played: [] };
    const frame = frameUrl ? (images.current.get('frame') ?? null) : null;
    const stickersOn = placed();
    const played = clips.current.map((clip) => clip.map((f) => composeFrame({ config, shot: f, stickers: stickersOn, frame, width: CLIP_PLAY_W })));
    try {
      const n = BEFORE + AFTER;
      for (const [width, count] of GIF_TRIES) {
        const at = spread(
          Array.from({ length: n }, (_, i) => i),
          count,
        );
        const frames = at.map((f) => composeStripFrame({ config, shots: clips.current.map((c) => c[f]), stickers: stickersOn, frame, width }));
        const gif = await encodeGif(frames, Math.round((n * FRAME_MS) / count));
        if (gif.size <= MAX_GIF_BYTES) return { gif, played };
      }
    } catch {
      /* (no animated strip this time) */
    }
    return { gif: null, played };
  }

  async function keep() {
    if (!picture) return;
    setPhase('saving');
    const gif = moving?.blob ?? null;
    if (test) {
      await wait(400);
      setToken('TEST');
      setPhase('qr');
      return;
    }
    const form = new FormData();
    form.append('booth', booth);
    form.append('file', new File([picture.blob], 'photo.jpg', { type: 'image/jpeg' }));
    if (gif) form.append('gif', new File([gif], 'photo.gif', { type: 'image/gif' }));
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
    if (guestPicks && stickerChoices.length) setPhase('choose');
    else void shoot();
  };

  // A big clicker or the keyboard does the main button of the step (Enter, Space, Page Down, Right arrow).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!['Enter', ' ', 'PageDown', 'ArrowRight'].includes(e.key)) return;
      if (phase === 'idle' && camera.ready && !camera.error) start();
      else if (phase === 'choose') void shoot();
      else if (phase === 'review') void keep();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ratio = config ? cellRatio(config.aspect) : 0.75;
  const showCam = phase === 'idle' || phase === 'choose' || phase === 'shoot';
  const total = config ? SHOTS[config.layout] : 0;
  const stage = (
    <div className={styles.stage} style={{ ['--accent' as string]: config?.accent ?? '#facc15', ['--ratio' as string]: ratio }}>
      <button type="button" className={styles.exit} onClick={onExit} aria-label="Leave the booth">
        <X size={18} aria-hidden="true" /> Exit
      </button>
      {test && <span className={styles.testTag}>Test Run · Nothing Is Saved</span>}
      <button
        type="button"
        className={`${styles.exit} ${styles.full}`}
        onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
        aria-label="Full screen"
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>
      {phase === 'idle' && <CameraMenu cameras={camera.cameras} current={camera.current} onChoose={camera.choose} />}

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
          {phase === 'idle' && wall.length > 0 && (
            <div className={styles.idleWall}>
              <PhotoWall photos={wall} dim />
            </div>
          )}
          {/* the camera stays on behind everything so the next guest starts at once */}
          <div className={`${styles.cam} ${showCam ? '' : styles.camHidden} ${phase === 'shoot' && flash ? styles.camSnap : ''}`}>
            <video
              ref={camera.attach}
              playsInline
              muted
              className={styles.video}
              style={{ transform: config.mirror ? 'scaleX(-1)' : undefined, filter: FILTER_CSS[config.filter] }}
            />
            {frameUrl && showCam && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.camFrame} src={frameUrl} alt="" />
            )}
            {showCam && phase !== 'idle' && (
              <StickerLayer
                stickers={onPicture}
                selected={guestPicks ? selected : null}
                locked={phase === 'shoot' || !guestPicks}
                onSelect={setSelected}
                onMove={(k, x, y) => patch(k, (s) => ({ ...s, x, y }))}
              />
            )}
            {phase === 'idle' && <div className={styles.dim} />}
            {phase === 'shoot' && count !== null && (
              <div className={styles.count} key={`${shotNo}-${count}`} aria-live="assertive">
                <span className={styles.ring} />
                <span className={styles.digit}>{count}</span>
              </div>
            )}
            {phase === 'shoot' && making && (
              <div className={styles.making}>
                <span className={styles.spinner} aria-hidden="true" />
                Making Your Picture…
              </div>
            )}
            {flash && <div className={styles.flash} />}
          </div>

          {phase === 'shoot' && thumbs.length > 0 && (
            <ol className={styles.filmstrip} aria-label="Photos so far">
              {thumbs.map((t, i) => (
                <li key={`${i}-${t.length}`} className={styles.filmTile}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t} alt={`Photo ${i + 1}`} />
                </li>
              ))}
            </ol>
          )}

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
              <h1 className={styles.welcomeTitle}>{config.welcome_title}</h1>
              {config.welcome_text && <p className={styles.welcomeText}>{config.welcome_text}</p>}
              <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={start} disabled={!camera.ready}>
                {camera.ready ? 'Start' : 'Starting Camera…'}
              </button>
              {error && <p className={styles.problem}>{error}</p>}
            </div>
          )}

          {phase === 'choose' && (
            <div className={styles.panel}>
              {stickerChoices.length > 0 && (
                <div className={styles.chips} aria-label="Stickers">
                  <span className={styles.chipLabel}>Stickers</span>
                  {stickerChoices.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`${styles.chip} ${styles.chipIn}`}
                      style={{ animationDelay: `${i * 45}ms` }}
                      onClick={() => addSticker(s)}
                      aria-label={`Add ${s.name}`}
                    >
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
                <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={() => void shoot()}>
                  Take The Photos
                </button>
              </div>
            </div>
          )}

          {phase === 'shoot' && (
            <div className={styles.shootBar}>
              <span className={styles.shotNo}>
                Photo {shotNo} of {total}
              </span>
              <span className={styles.dots} aria-hidden="true">
                {Array.from({ length: total }, (_, i) => (
                  <i key={i} className={i + 1 < shotNo || (i + 1 === shotNo && count === null && !making && flash) ? styles.dotDone : i + 1 === shotNo ? styles.dotNow : ''} />
                ))}
              </span>
              {prompt && (
                <span className={styles.prompt} key={`${shotNo}-${prompt}`}>
                  {prompt}
                </span>
              )}
              <button type="button" className={styles.ghostBtn} onClick={reset}>
                Cancel
              </button>
            </div>
          )}

          {(phase === 'review' || phase === 'saving') && picture && (
            <div className={styles.review}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={`${styles.reviewImg} ${styles.dropIn}`} src={moving?.url ?? picture.url} alt="Your picture, moving" />
              {playing.length > 0 && <ClipPlayer clips={playing} frameMs={FRAME_MS} />}
              <div className={`${styles.reviewSide} ${styles.riseIn}`}>
                <h2 className={styles.qrTitle}>How Does It Look?</h2>
                {error && <p className={styles.problem}>{error}</p>}
                <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={() => void keep()} disabled={phase === 'saving'}>
                  {phase === 'saving' ? 'Saving…' : 'Looks Great!'}
                </button>
                {total > 1 && (
                  <div className={styles.retakes} role="group" aria-label="Retake one photo">
                    <span className={styles.chipLabel}>Retake just one</span>
                    <div className={styles.retakeRow}>
                      {thumbs.map((t, i) => (
                        <button
                          key={i}
                          type="button"
                          className={styles.retakeBtn}
                          onClick={() => void retakeOne(i)}
                          disabled={phase === 'saving'}
                          aria-label={`Retake photo ${i + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t} alt="" />
                          <span>
                            <RotateCcw size={14} aria-hidden="true" /> {i + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" className={styles.ghostBtn} onClick={() => (setError(''), void shoot())} disabled={phase === 'saving'}>
                  {total > 1 ? 'Retake All' : 'Retake'}
                </button>
              </div>
              {phase === 'saving' && (
                <div className={styles.savingVeil}>
                  <span className={styles.spinner} aria-hidden="true" /> Saving…
                </div>
              )}
            </div>
          )}

          {phase === 'qr' && picture && token && <QrScreen token={token} picture={moving?.url ?? picture.url} seconds={config.qr_seconds} test={test} onDone={reset} />}
        </>
      )}
    </div>
  );
  return mounted ? createPortal(stage, document.body) : null;
}
