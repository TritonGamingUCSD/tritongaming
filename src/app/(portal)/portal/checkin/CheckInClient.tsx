'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
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
}

interface CheckinStats {
  total: number;
  checked_in: number;
}

interface DebugInfo {
  received: string;
  windowIndex: number;
  candidates: Array<{ status: string; expected_now: string; expected_prev: string }>;
}

export default function CheckInClient({ events }: { events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id || '');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<CheckinStats | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const resultTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const fetchStats = useCallback(async (eventId: string) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}?stats=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchStats(selectedEventId);
  }, [selectedEventId, fetchStats]);

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(scanFrame);
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animRef.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
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

  async function handleCheckIn(ticketCode: string) {
    if (!selectedEventId) {
      setError('Please select an event first.');
      return;
    }
    processingRef.current = true;
    setProcessing(true);
    setResult(null);
    setError('');
    setDebugInfo(null);
    if (resultTimeout.current) clearTimeout(resultTimeout.current);

    try {
      const response = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: ticketCode, event_id: selectedEventId }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
        if (data.status === 'active') {
          // Successful check-in: update stats
          setStats((prev) => prev ? { ...prev, checked_in: prev.checked_in + 1 } : null);
        }
      } else {
        setError(data.error || 'Check-in failed.');
        // Temporary: surfaces exactly what the server expected vs. what was
        // scanned, so a "not recognized" report can be diagnosed for real
        // instead of guessed at.
        if (data.debug) console.log('[checkin debug]', data.debug);
        setDebugInfo(data.debug ?? null);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      processingRef.current = false;
      setProcessing(false);
      // Leave debug info on screen until the next scan — 4s isn't enough
      // time to actually read and compare hex codes.
      resultTimeout.current = setTimeout(() => {
        setResult(null);
        lastCodeRef.current = '';
        setDebugInfo((current) => {
          if (current) return current;
          setError('');
          return null;
        });
      }, 4000);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleCheckIn(manualCode.trim());
    setManualCode('');
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      stopCamera();
      if (resultTimeout.current) clearTimeout(resultTimeout.current);
    };
  }, []);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  if (events.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.noEvents}>
          <span className={styles.noEventsIcon}>📅</span>
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
        <select
          className={styles.select}
          value={selectedEventId}
          onChange={(e) => { setSelectedEventId(e.target.value); stopCamera(); setResult(null); setError(''); setDebugInfo(null); }}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title} — {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </option>
          ))}
        </select>
      </div>

      {/* ── Stats strip ───────────────────────────── */}
      {stats && (
        <div className={styles.statsStrip}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{stats.checked_in}</span>
            <span className={styles.statLab}>Checked In</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{stats.total}</span>
            <span className={styles.statLab}>Registered</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>{stats.total > 0 ? Math.round(stats.checked_in / stats.total * 100) : 0}%</span>
            <span className={styles.statLab}>Attendance</span>
          </div>
        </div>
      )}

      {/* ── Camera viewport ───────────────────────── */}
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
            <div className={styles.scanBox}>
              <div className={styles.corner} data-pos="tl" />
              <div className={styles.corner} data-pos="tr" />
              <div className={styles.corner} data-pos="bl" />
              <div className={styles.corner} data-pos="br" />
              <div className={styles.scanLine} />
            </div>
            {processing && <div className={styles.processingBadge}>Processing…</div>}
          </div>
        )}

        {!scanning && (
          <div className={styles.placeholder} onClick={startCamera} role="button" tabIndex={0}>
            <span className={styles.placeholderIcon}>📷</span>
            <p className={styles.placeholderText}>Tap to Start Scanner</p>
            {selectedEvent && (
              <p className={styles.placeholderEvent}>{selectedEvent.title}</p>
            )}
          </div>
        )}

        {/* Result overlay on viewport */}
        {result && (
          <div className={`${styles.resultOverlay} ${result.status === 'active' ? styles.resultSuccess : styles.resultWarn}`}>
            {result.status === 'active' ? (
              <>
                <span className={styles.resultIcon}>✓</span>
                <div className={styles.resultName}>{result.user_name}</div>
                <div className={styles.resultDetail}>Checked in!</div>
              </>
            ) : (
              <>
                <span className={styles.resultIcon}>⚠</span>
                <div className={styles.resultName}>
                  {result.status === 'used' ? 'Already checked in' : `Ticket ${result.status}`}
                </div>
                {result.status === 'used' && result.checked_in_at && (
                  <div className={styles.resultDetail}>
                    at {new Date(result.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <div className={styles.errorOverlay}>
            <div>{error}</div>
            {debugInfo && (
              <div className={styles.debugBox}>
                <div>scanned: {debugInfo.received}</div>
                {debugInfo.candidates.length === 0 ? (
                  <div>no tickets exist for this event at all</div>
                ) : (
                  debugInfo.candidates.map((c, i) => (
                    <div key={i}>
                      {c.status}: expects {c.expected_now} (or {c.expected_prev})
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
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
        <button
          className={styles.manualToggle}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? 'Hide' : 'Manual Entry'}
        </button>
      </div>

      {/* ── Manual entry ─────────────────────────── */}
      {showManual && (
        <form className={styles.manualForm} onSubmit={handleManualSubmit}>
          <input
            className={styles.manualInput}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter the code shown in their app…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.manualBtn} disabled={processing}>
            Check In
          </button>
        </form>
      )}
    </div>
  );
}
