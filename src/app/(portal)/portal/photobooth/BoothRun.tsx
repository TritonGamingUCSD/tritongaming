'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, RotateCcw, X } from 'lucide-react';
import Loading from '@/components/Loading/Loading';
import Notice from '@/components/ui/Notice';
import { PhotoWall, type WallPhoto } from '@/components/PhotoWall/PhotoWall';
import { FILTER_CSS, SHOTS, cellRatio, composition, cellSize, hexToRgb, promptFor, type BoothConfig } from '@/lib/photobooth/booth';
import { autoAdjust, composeFrame, composePicture, composeStripFrame, cutShot, loadImage, type PlacedSticker } from '@/lib/photobooth/compose';
import { GIF_TRIES, MAX_GIF_BYTES, encodeGif, spread } from '@/lib/photobooth/gif';
import { HOLD_END, playbackTicks, type Tick } from '@/lib/photobooth/playback';
import { BoothSounds } from '@/lib/photobooth/sounds';
import { call, type BoothData } from './api';
import { CameraMenu } from './CameraMenu';
import { LivePicker } from './LivePicker';
import { ClipPlayer } from './ClipPlayer';
import { StripPlayer, type StripPlayback } from './StripPlayer';
import { QrScreen } from './QrScreen';
import { useCamera } from './useCamera';
import styles from './photobooth.module.css';

type Phase = 'idle' | 'choose' | 'shoot' | 'review' | 'saving' | 'qr';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THUMB_W = 180;
// A live clip for each shot: the camera is sampled all through the countdown and the last 3 seconds before the shutter are kept (the strip plays them and freezes on the shot).
const FRAME_MS = 125;
const BEFORE = 24;
const CLIP_W = 320;
const CLIP_PLAY_W = 480;
const SCREEN_STRIP_W = 420;

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
  const [count, setCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState('');
  const [shotNo, setShotNo] = useState(0);
  const [flash, setFlash] = useState(false);
  const [making, setMaking] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [picture, setPicture] = useState<{ blob: Blob; url: string } | null>(null);
  const [moving, setMoving] = useState<{ blob: Blob; url: string } | null>(null); // the animated strip
  const [playback, setPlayback] = useState<StripPlayback | null>(null); // the strip playing, for the screens
  const [playing, setPlaying] = useState<HTMLCanvasElement[][]>([]); // the finished frames of each shot's clip, for the big player
  const [token, setToken] = useState('');
  const [lookId, setLookId] = useState(''); // the look the guest picked (the first one until they do)
  const [wall, setWall] = useState<WallPhoto[]>([]); // every picture in the booth's gallery, drifting behind the welcome screen
  const camera = useCamera();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0); // (a portal needs the page: not drawn on the server)
    return () => window.clearTimeout(t);
  }, []);
  const images = useRef(new Map<string, HTMLImageElement>());
  const shots = useRef<HTMLCanvasElement[]>([]);
  const clips = useRef<HTMLCanvasElement[][]>([]); // each shot's raw clip frames (BEFORE of them)
  const sounds = useRef<BoothSounds | null>(null);
  const run = useRef(0); // a number for each go at the shots: leaving or cancelling makes the running one stop

  useEffect(() => {
    void (async () => {
      const r = await call<BoothData>(`/api/photobooth/booths/${booth}`);
      if (!r.ok) return setError(r.error);
      setData(r.data);
      sounds.current = new BoothSounds(r.data.config.sounds);
      setLookId(r.data.looks[0]?.id ?? '');
      for (const l of r.data.looks) {
        for (const o of l.overlays)
          loadImage(o.image)
            .then((img) => images.current.set(o.id, img))
            .catch(() => undefined);
        if (l.frame.image)
          loadImage(l.frame.image)
            .then((img) => images.current.set(`frame-${l.id}`, img))
            .catch(() => undefined);
      }
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

  const looks = data?.looks ?? [];
  const look = looks.find((l) => l.id === lookId) ?? looks[0];
  const config: BoothConfig | undefined = useMemo(() => (data && look ? { ...data.config, ...look.style } : undefined), [data, look]);
  const stickerList = look?.overlays ?? [];
  const frameUrl = look?.frame.image ?? '';
  const frameImage = () => (look && frameUrl ? (images.current.get(`frame-${look.id}`) ?? null) : null);

  const reset = useCallback(() => {
    run.current++;
    shots.current = [];
    clips.current = [];
    setMoving(null);
    setPlayback(null);
    setPlaying([]);
    setPhase('idle');
    setPicture(null);
    setToken('');
    setCount(null);
    setPrompt('');
    setShotNo(0);
    setThumbs([]);
    setMaking(false);
  }, []);

  /** The stickers that belong on photo `i` (0-based), where the host placed them. */
  const placedFor = (i: number): PlacedSticker[] =>
    stickerList.flatMap((o) => {
      const image = images.current.get(o.id);
      const p = o.placements[i];
      return image && p ? [{ image, x: p.x, y: p.y, size: p.size, rotation: (p.rotation * Math.PI) / 180 }] : [];
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
    const sampler = window.setInterval(() => {
      before.push(cutShot(video, CLIP_W, Math.round((CLIP_W * h) / w)));
      if (before.length > BEFORE) before.shift();
    }, FRAME_MS);
    try {
      for (let c = config.countdown; c >= 1; c--) {
        if (!alive()) return null;
        setCount(c);
        sounds.current?.tick(c, config.countdown);
        await wait(1000);
      }
      if (!alive()) return null;
      setCount(null);
      sounds.current?.shutter();
      if (config.flash) {
        setFlash(true);
        setTimeout(() => setFlash(false), 180);
      }
      const shot = cutShot(video, w, h);
      await wait(700);
      const clip = [...before];
      // (a short countdown has fewer moments: the first one is held so every clip is as long as the others)
      while (clip.length < BEFORE) clip.unshift(clip[0] ?? shot);
      autoAdjust(shot, clip, config.auto_adjust);
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
      const blob = await composePicture({ config, shots: shots.current, stickers: placedFor, frame: frameImage() });
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
      setPlayback(strip.playback);
      setThumbs(shots.current.map(thumbOf));
      setMaking(false);
      setPhase('review');
      sounds.current?.chime();
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
    for (let i = 0; i < SHOTS[config.layout]; i++) {
      const got = await takeShot(i, alive);
      if (!got) return;
      shots.current.push(got.shot);
      clips.current.push(got.clip);
      setThumbs((t) => [...t, thumbOf(got.shot)]);
      sounds.current?.pop();
      if (i < SHOTS[config.layout] - 1) {
        // (a beat to laugh, change pose or swap places before the next countdown)
        setPrompt('Next one in a moment…');
        await wait(1300);
        if (!alive()) return;
      }
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

  /** What the finished strip plays: each photo's moments before its shot and then the shot itself. Gives the strip's playback for the screens (each photo in turn, then all together), the finished frames of each clip for the big player, and the animated
   * picture to keep (all photos together, then held on the shots, as small as it needs to be; null if it cannot be made: the picture is still kept). */
  async function movingStrip(): Promise<{ gif: Blob | null; played: HTMLCanvasElement[][]; playback: StripPlayback }> {
    const empty = { ticks: [], render: () => document.createElement('canvas') };
    if (!config) return { gif: null, played: [], playback: empty };
    const frame = frameImage();
    const seqs = shots.current.map((shot, i) => [...clips.current[i].slice(0, BEFORE), shot]);
    const played = seqs.map((seq, i) => seq.map((f) => composeFrame({ config, shot: f, stickers: placedFor(i), frame, width: CLIP_PLAY_W })));
    const draw = (at: Tick, width: number) => composeStripFrame({ config, shots: seqs.map((seq, i) => seq[at[i]]), stickers: placedFor, frame, width });
    const playback: StripPlayback = { ticks: playbackTicks(seqs.length, BEFORE + 1), render: (at) => draw(at, SCREEN_STRIP_W) };
    const together = (f: number) => Array<number>(seqs.length).fill(f);
    try {
      for (const [width, count] of GIF_TRIES) {
        const at = spread(
          Array.from({ length: BEFORE }, (_, i) => i),
          count,
        );
        const frames = [...at, BEFORE].map((f) => draw(together(f), width));
        const gif = await encodeGif(frames, Math.round((BEFORE * FRAME_MS) / count), HOLD_END * FRAME_MS);
        if (gif.size <= MAX_GIF_BYTES) return { gif, played, playback };
      }
      console.warn('The animated strip was too big to save at every size.');
    } catch (e) {
      console.warn('The animated strip could not be made.', e);
    }
    return { gif: null, played, playback };
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
      sounds.current?.chime();
    } else {
      setError(json.error ?? 'The picture could not be saved. Check the connection and try again.');
      setPhase('review');
    }
  }

  const start = () => {
    sounds.current?.unlock();
    setError('');
    if (looks.length > 1) setPhase('choose');
    else void shoot();
  };

  // A big clicker or the keyboard does the main button of the step (Enter, Space, Page Down, Right arrow).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (phase === 'choose' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const at = Math.max(
          0,
          looks.findIndex((l) => l.id === look?.id),
        );
        setLookId(looks[(at + (e.key === 'ArrowRight' ? 1 : looks.length - 1)) % looks.length].id);
        e.preventDefault();
        return;
      }
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
  const strip = config ? composition(config.layout, config.aspect, !!config.footer.trim()) : null; // where each photo sits on the strip (for tapping one to retake it)
  const showCam = phase === 'idle' || phase === 'choose' || phase === 'shoot';
  const total = config ? SHOTS[config.layout] : 0;
  // (the stickers of the photo being taken, over the live camera)
  const placedNow = stickerList.flatMap((o) => {
    const p = o.placements[Math.max(0, shotNo - 1)];
    return p ? [{ o, p }] : [];
  });
  const stage = (
    <div
      className={styles.stage}
      style={{
        ['--accent' as string]: config?.accent ?? '#facc15',
        ['--ratio' as string]: ratio,
        ...(config?.screen_bg ? { ['--screen-bg' as string]: config.screen_bg } : {}),
        ...(config?.screen_ink ? { ['--screen-ink' as string]: config.screen_ink, ['--screen-rgb' as string]: hexToRgb(config.screen_ink) } : {}),
      }}
    >
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
      <p className={styles.brand}>Triton Gaming · Gaming Org at UC San Diego</p>
      {phase === 'idle' && <CameraMenu cameras={camera.cameras} current={camera.current} info={camera.info} onChoose={camera.choose} />}

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
          <div className={`${styles.booth} ${phase === 'choose' ? styles.boothWide : ''} ${showCam ? '' : styles.boothHidden}`}>
            <div className={styles.side}>
              {phase === 'idle' && !camera.error && (
                <>
                  <p className={styles.kicker}>{data.booth.name}</p>
                  <h1 className={styles.welcomeTitle}>
                    <span className={styles.mark}>{config.welcome_title}</span>
                  </h1>
                  {config.welcome_text && <p className={styles.welcomeText}>{config.welcome_text}</p>}
                  <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={start} disabled={!camera.ready}>
                    {camera.ready ? 'Start' : 'Starting Camera…'}
                  </button>
                  <p className={styles.hint}>Tap Start or press Enter</p>
                  {error && <p className={styles.problem}>{error}</p>}
                </>
              )}

              {phase === 'choose' && (
                <>
                  <p className={styles.kicker}>{total} photos</p>
                  <h2 className={styles.sideTitle}>Pick Your Look</h2>
                  <p className={styles.welcomeText}>The look is live with the camera. Slide, tap an arrow or press ← → to see the others.</p>
                  <div className={styles.btnRow}>
                    <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={() => void shoot()}>
                      Use This Look
                    </button>
                    <button type="button" className={styles.ghostBtn} onClick={reset}>
                      Cancel
                    </button>
                  </div>
                  <p className={styles.hint}>Arrow keys change the look, Enter starts</p>
                </>
              )}

              {phase === 'shoot' && (
                <>
                  <p className={styles.kicker}>
                    Photo {shotNo} of {total}
                  </p>
                  <h2 className={`${styles.sideTitle} ${styles.prompt}`} key={`${shotNo}-${prompt}`}>
                    <span className={styles.mark}>{prompt || 'Get ready!'}</span>
                  </h2>
                  <span className={styles.dots} aria-hidden="true">
                    {Array.from({ length: total }, (_, i) => (
                      <i key={i} className={i + 1 < shotNo || (i + 1 === shotNo && count === null && !making && flash) ? styles.dotDone : i + 1 === shotNo ? styles.dotNow : ''} />
                    ))}
                  </span>
                  {thumbs.length > 0 && (
                    <ol className={styles.filmstrip} aria-label="Photos so far">
                      {thumbs.map((t, i) => (
                        <li key={`${i}-${t.length}`} className={styles.filmTile}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t} alt={`Photo ${i + 1}`} />
                        </li>
                      ))}
                    </ol>
                  )}
                  <button type="button" className={styles.ghostBtn} onClick={reset}>
                    Cancel
                  </button>
                </>
              )}
            </div>

            {phase === 'choose' && data && <LivePicker video={camera.video.current} base={data.config} looks={looks} selectedId={look?.id ?? ''} onPick={setLookId} />}
            <div className={`${styles.cam} ${phase === 'choose' ? styles.camOff : ''} ${phase === 'shoot' && flash ? styles.camSnap : ''}`}>
              <video ref={camera.attach} playsInline muted className={styles.video} style={{ transform: 'scaleX(-1)', filter: FILTER_CSS[config.filter] }} />
              {frameUrl && showCam && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.camFrame} src={frameUrl} alt="" />
              )}
              {(phase === 'shoot' || phase === 'choose') && placedNow.length > 0 && (
                <div className={styles.stickerLayer}>
                  {placedNow.map(({ o, p }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={o.id}
                      src={o.image}
                      alt=""
                      draggable={false}
                      className={styles.placed}
                      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.size * 100}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}
                    />
                  ))}
                </div>
              )}
              {showCam && (
                <span className={styles.liveTag}>
                  <i aria-hidden="true" /> Live
                </span>
              )}
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
          </div>

          {camera.error && (
            <div className={styles.center}>
              <Notice tone="error">{camera.error}</Notice>
              <button type="button" className={styles.bigBtn} onClick={() => void camera.retry()}>
                Try Again
              </button>
            </div>
          )}

          {(phase === 'review' || phase === 'saving') && picture && (
            <div className={styles.review}>
              <div className={`${styles.stripWrap} ${styles.dropIn}`}>
                {playback ? (
                  <StripPlayer playback={playback} frameMs={FRAME_MS} className={styles.reviewImg} label="Your picture, moving" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.reviewImg} src={picture.url} alt="Your picture" />
                )}
                {total > 1 && strip && (
                  <div className={styles.stripHots}>
                    {strip.cells.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        className={styles.stripHot}
                        style={{
                          left: `${(c.x / strip.width) * 100}%`,
                          top: `${(c.y / strip.height) * 100}%`,
                          width: `${(c.w / strip.width) * 100}%`,
                          height: `${(c.h / strip.height) * 100}%`,
                        }}
                        onClick={() => void retakeOne(i)}
                        disabled={phase === 'saving'}
                        aria-label={`Retake photo ${i + 1} of ${total}`}
                      >
                        <span>
                          <RotateCcw size={16} aria-hidden="true" /> Retake
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {playing.length > 0 && <ClipPlayer clips={playing} frameMs={FRAME_MS} />}
              <div className={`${styles.reviewSide} ${styles.riseIn}`}>
                <h2 className={styles.qrTitle}>
                  <span className={styles.mark}>How Does It Look?</span>
                </h2>
                {error && <p className={styles.problem}>{error}</p>}
                <button type="button" className={`${styles.bigBtn} ${styles.startBtn}`} onClick={() => void keep()} disabled={phase === 'saving'}>
                  {phase === 'saving' ? 'Saving…' : 'Looks Great!'}
                </button>
                {total > 1 && <p className={styles.reviewHint}>Not happy with one? Tap that photo to take it again.</p>}
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

          {phase === 'qr' && picture && token && (
            <QrScreen token={token} picture={picture.url} playback={playback} frameMs={FRAME_MS} seconds={config.qr_seconds} test={test} onDone={reset} />
          )}
        </>
      )}
    </div>
  );
  return mounted ? createPortal(stage, document.body) : null;
}
