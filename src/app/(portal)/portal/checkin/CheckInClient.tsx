'use client';

import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Calendar, Camera, CircleCheck, TriangleAlert } from 'lucide-react';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/timezone';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type { Tier } from '@/lib/tiers';
import styles from './checkin.module.css';

interface Event {
  id: string;
  title: string;
  start_date: string;
}

interface ScanResult {
  status: 'active' | 'used' | 'cancelled' | 'expired';
  event_title: string;
  user_name: string;
  checked_in_at?: string;
  ticket_id?: string;
  requires_form?: boolean;
  form_completed?: boolean;
  day_number?: number | null;
  day_total?: number | null;
  later_day?: boolean;
  points_awarded?: number;
  lifetime_points?: number;
  tier?: string;
}

const CODE_LENGTH = 6;
const EMPTY_DIGITS = Array<string>(CODE_LENGTH).fill('');

interface CheckInClientProps {
  events: Event[];
  onCheckedIn?: (entry: { ticketId: string; userName: string }) => void;
  tiers: Tier[];
}

export default function CheckInClient({ events, onCheckedIn, tiers }: CheckInClientProps) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || '');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [shake, setShake] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  // scanFrame recurses via requestAnimationFrame(scanFrame) referencing itself,
  // so it never picks up fresh state from re-renders — reading `processing`/
  // `lastCode` as plain state here always saw their values from the moment
  // startCamera() first scheduled it, permanently stuck at `false`/`''`. That
  // meant every frame that saw a QR (~60/sec) fired a brand new check-in
  // request, forever — the flashing and the flood of duplicate requests
  // reported. Refs are mutable and read fresh every frame regardless of
  // which closure is doing the reading, so they're the actual fix.
  const processingRef = useRef(false);
  const lastCodeRef = useRef('');
  // getUserMedia() is async and can take a real moment — a permission
  // prompt the person doesn't answer right away, or just a slow camera to
  // initialize. If they navigate away *during* that wait, this component
  // unmounts before the promise resolves, and videoRef.current goes back to
  // null. The old code only checked that ref before attaching the stream —
  // true, so it never attached — but it never stopped the stream either,
  // just silently dropped the reference to it. Whatever tracks the browser
  // had already granted stayed live forever, which is exactly "the site
  // still thinks it's using the camera" after leaving the page. This ref is
  // the only thing that lets startCamera tell "still here" apart from
  // "gone before the promise even settled."
  const mountedRef = useRef(true);
  // stopCamera() used to reach the running stream only via
  // videoRef.current.srcObject — fine when it runs from the "Stop Camera"
  // button (component still fully mounted, ref still attached), but the
  // unmount cleanup below can run *after* React has already detached
  // videoRef (e.g. closing the portal hub panel this sits in defers the
  // actual unmount slightly for its exit animation, and the <video> element
  // is gone from the DOM by the time cleanup runs). At that point
  // videoRef.current is null, the old guard silently no-opped, and the
  // stream's tracks were never told to stop — the exact "camera still
  // accessing after clicking Dashboard without hitting Stop Camera first"
  // leak. Holding the stream here too means stopCamera() can always reach
  // it directly, independent of whether the video element still exists.
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(scanFrame);
      } else {
        // No video element to attach to for some other reason — don't leave
        // the camera held open for nothing.
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    if (code?.data && code.data !== lastCodeRef.current && !processingRef.current) {
      lastCodeRef.current = code.data;
      handleCheckIn(code.data);
    }
    animRef.current = requestAnimationFrame(scanFrame);
  }

  // Brief red pulse on the code boxes for a wrong/unrecognized code — the
  // manual-entry equivalent of the camera flow's error overlay, but fast
  // enough that staff sees it as feedback on what they just typed rather
  // than a modal they have to wait out.
  function triggerShake() {
    setShake(true);
    if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    shakeTimeout.current = setTimeout(() => setShake(false), 500);
  }

  async function handleCheckIn(ticketCode: string) {
    if (!selectedEventId) {
      setError('Please select an event first.');
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    setResult(null);
    setError('');
    if (resultTimeout.current) clearTimeout(resultTimeout.current);

    try {
      const response = await fetchWithRetry('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ticketCode, event_id: selectedEventId }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
        if (data.status === 'active' && data.ticket_id) {
          onCheckedIn?.({ ticketId: data.ticket_id, userName: data.user_name });
        }
      } else {
        setError(data.error || 'Check-in failed.');
        triggerShake();
      }
    } catch {
      setError('Network error. Please try again.');
      triggerShake();
    } finally {
      processingRef.current = false;
      setProcessing(false);
      resultTimeout.current = setTimeout(() => {
        setResult(null);
        setError('');
        lastCodeRef.current = '';
        setDigits(EMPTY_DIGITS);
        codeRefs.current[0]?.focus();
      }, 4000);
    }
  }

  // Fires the instant all six boxes are filled — no separate submit button,
  // matching an authenticator app's code entry.
  useEffect(() => {
    const joined = digits.join('');
    if (joined.length === CODE_LENGTH && !processingRef.current) {
      handleCheckIn(joined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function handleDigitChange(index: number, rawValue: string) {
    // A leftover result/error from the previous code shouldn't block or
    // confuse entry of the next one — clear it the moment new input starts
    // instead of making staff wait out the auto-clear timer.
    if (result) setResult(null);
    if (error) setError('');

    const value = rawValue.replace(/\D/g, '');
    if (!value) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    // Typing fast (or a browser that hands onChange more than one new
    // character at once) can land several digits in a single box — spill
    // the extra ones into the following boxes instead of dropping them.
    const chars = value.split('');
    setDigits((prev) => {
      const next = [...prev];
      let i = index;
      for (const ch of chars) {
        if (i > CODE_LENGTH - 1) break;
        next[i] = ch;
        i++;
      }
      return next;
    });
    const nextIndex = Math.min(index + chars.length, CODE_LENGTH - 1);
    requestAnimationFrame(() => codeRefs.current[nextIndex]?.focus());
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
      setDigits((prev) => {
        const next = [...prev];
        next[index - 1] = '';
        return next;
      });
    }
  }

  // The boxes are a display, not six independently-addressable fields —
  // entry always continues from the leftmost empty one and Backspace always
  // removes the rightmost filled one, no matter which box is actually
  // clicked. Intercepted on mousedown (not focus) specifically so this only
  // reacts to real clicks — auto-advance and the backspace handler above
  // already call .focus() on the exact box they mean, and re-running this
  // check from an onFocus handler would immediately re-redirect those away
  // from where they just intentionally moved.
  function activeIndex(): number {
    const empty = digits.findIndex((d) => d === '');
    return empty === -1 ? CODE_LENGTH - 1 : empty;
  }

  function handleDigitMouseDown(index: number, e: React.MouseEvent<HTMLInputElement>) {
    const idx = activeIndex();
    if (idx !== index) {
      e.preventDefault();
      codeRefs.current[idx]?.focus();
    }
  }

  function handleDigitPaste(startIndex: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    if (result) setResult(null);
    if (error) setError('');
    setDigits((prev) => {
      const next = [...prev];
      let i = startIndex;
      for (const ch of text) {
        if (i > CODE_LENGTH - 1) break;
        next[i] = ch;
        i++;
      }
      return next;
    });
    const focusIndex = Math.min(startIndex + text.length, CODE_LENGTH - 1);
    requestAnimationFrame(() => codeRefs.current[focusIndex]?.focus());
  }

  useEffect(() => {
    // React Strict Mode (dev only) double-invokes this effect on initial
    // mount — mount, cleanup, mount again — specifically to surface effects
    // that don't clean up properly. Without resetting it back to true here,
    // that phantom first cleanup permanently left mountedRef.current false,
    // so every real startCamera() afterward saw "already unmounted" and
    // stopped its own stream the instant it got one — the camera would
    // never actually turn on in dev.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(animRef.current);
      stopCamera();
      if (resultTimeout.current) clearTimeout(resultTimeout.current);
      if (shakeTimeout.current) clearTimeout(shakeTimeout.current);
    };
  }, []);

  // Unmounting isn't the only way this camera should let go of the
  // hardware — backgrounding the tab (locking the phone, switching apps
  // mid-shift) leaves the page mounted and the MediaStream tracks "live"
  // indefinitely, so the OS/browser's camera-in-use indicator stays lit
  // even though nothing is actually reading frames anymore. Releasing on
  // visibilitychange means it's only ever holding the camera while the
  // scanner is actually the thing on screen; coming back just needs one more
  // tap on "Start Camera", the same as a fresh page load.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') stopCamera();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  if (events.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.noEvents}>
          <span className={styles.noEventsIcon}><Calendar size={40} strokeWidth={1.25} aria-hidden="true" /></span>
          <h2 className={styles.noEventsTitle}>No active events</h2>
          <p className={styles.noEventsSub}>Events appear here within 24 hours of their start time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Event selector ────────────────────────── */}
      <div className={styles.eventSelect}>
        <span className={styles.eventSelectLabel}>Checking in for</span>
        <div className={styles.selectWrap}>
          <select
            className={styles.select}
            value={selectedEventId}
            onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); setResult(null); setError(''); }}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title} — {formatPacificDateTime(event.start_date)}
              </option>
            ))}
          </select>
          <span className={styles.selectChevron} aria-hidden="true">▾</span>
        </div>
      </div>

      {/* ── Combined scanner card: camera + always-on code entry ───── */}
      <div className={styles.scannerCard}>
        <div className={styles.viewport}>
          <video
            ref={videoRef}
            className={`${styles.video} ${!scanning ? styles.hidden : ''}`}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={canvasRef} className={styles.canvas} />

          {scanning && (
            <div className={styles.overlay}>
              <div className={styles.scanBox} />
            </div>
          )}

          {!scanning && (
            <div className={styles.placeholder} onClick={startCamera} role="button" tabIndex={0}>
              <span className={styles.placeholderIcon}><Camera size={40} strokeWidth={1.25} aria-hidden="true" /></span>
              <p className={styles.placeholderText}>Tap to Start Scanner</p>
              {selectedEvent && (
                <p className={styles.placeholderEvent}>{selectedEvent.title}</p>
              )}
            </div>
          )}
        </div>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span>or type the code</span>
          <span className={styles.dividerLine} />
        </div>

        <div className={styles.codeSection}>
          <div className={styles.codeEntry}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { codeRefs.current[i] = el; }}
                className={`${styles.codeBox} ${digit ? styles.codeBoxFilled : ''} ${shake ? styles.codeBoxShake : ''}`}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleDigitKeyDown(i, e)}
                onMouseDown={(e) => handleDigitMouseDown(i, e)}
                onPaste={(e) => handleDigitPaste(i, e)}
                inputMode="numeric"
                maxLength={1}
                autoComplete="off"
                disabled={processing}
                aria-label={`Code digit ${i + 1} of ${CODE_LENGTH}`}
              />
            ))}
          </div>
          {processing && <div className={styles.checkingText}>Checking…</div>}
        </div>

        {/* Result/error overlay covers the whole card — camera and manual
            entry feed the same shared outcome, not two separate flows. */}
        {result && (
          <div className={`${styles.resultOverlay} ${result.status === 'active' ? styles.resultSuccess : styles.resultWarn}`}>
            {result.status === 'active' ? (
              <>
                <span className={styles.resultIcon}><CircleCheck size={40} strokeWidth={1.5} aria-hidden="true" /></span>
                <div className={styles.resultName}>{result.user_name}</div>
                <div className={styles.resultDetail}>
                  {result.day_total && result.day_total > 1 ? `Checked in — Day ${result.day_number ?? '?'} of ${result.day_total}` : 'Checked in!'}
                </div>
                {result.requires_form && (
                  <div className={styles.resultFormBadge}>
                    <strong>AS Form still to do</strong>
                    <span>Tell them: “Scanning isn’t check-in — finish your AS Form on your phone now.”</span>
                  </div>
                )}
                {!!result.points_awarded && (
                  <div className={styles.resultPoints}>
                    <span className={styles.resultPointsGain}>+{result.points_awarded} pts</span>
                    {result.lifetime_points !== undefined && result.tier && (
                      <span
                        className={styles.resultTierBadge}
                        style={{ color: tiers.find((t) => t.name === result.tier)?.color, borderColor: `${tiers.find((t) => t.name === result.tier)?.color}55` }}
                      >
                        {result.lifetime_points.toLocaleString()} pts · {result.tier}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <span className={styles.resultIcon}><TriangleAlert size={40} strokeWidth={1.5} aria-hidden="true" /></span>
                <div className={styles.resultName}>
                  {result.status === 'used' ? 'Already checked in today' : `Ticket ${result.status}`}
                </div>
                {result.status === 'used' && result.checked_in_at && (
                  <div className={styles.resultDetail}>
                    at {new Date(result.checked_in_at).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
                {result.status === 'used' && result.requires_form && (
                  <div className={result.form_completed ? styles.resultFormDone : styles.resultFormBadge}>
                    {result.form_completed ? 'AS Form opened — check their “response recorded” screen' : 'AS Form not opened yet'}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className={styles.errorOverlay}>{error}</div>
        )}
      </div>

      {/* ── Camera controls ───────────────────────── */}
      <div className={styles.controls}>
        {!scanning ? (
          <button className={styles.startBtn} onClick={startCamera}>
            Start Camera
          </button>
        ) : (
          <button className={styles.stopBtn} onClick={stopCamera}>
            Stop Camera
          </button>
        )}
      </div>
    </div>
  );
}
