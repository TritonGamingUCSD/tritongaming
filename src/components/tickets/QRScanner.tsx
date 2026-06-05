'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import styles from './QRScanner.module.css';

interface ScanResult {
  ticket_code: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  event_title: string;
  user_name: string;
  checked_in_at?: string;
}

interface Props {
  eventId: string;
}

export default function QRScanner({ eventId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastCode, setLastCode] = useState('');

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        scanFrame();
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

    if (code && code.data && code.data !== lastCode && !processing) {
      setLastCode(code.data);
      handleCheckIn(code.data);
    }

    animRef.current = requestAnimationFrame(scanFrame);
  }

  async function handleCheckIn(ticketCode: string) {
    setProcessing(true);
    setResult(null);
    try {
      const response = await fetch('/api/tickets/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_code: ticketCode, event_id: eventId }),
      });
      const data = await response.json();
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Check-in failed.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setProcessing(false);
      // Reset after 4 seconds to allow re-scanning
      setTimeout(() => {
        setResult(null);
        setError('');
        setLastCode('');
      }, 4000);
    }
  }

  async function handleManualEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = (e.currentTarget.elements.namedItem('code') as HTMLInputElement).value.trim();
    if (!code) return;
    await handleCheckIn(code);
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      stopCamera();
    };
  }, []);

  return (
    <div className={styles.scanner}>
      <div className={styles.viewport}>
        <video
          ref={videoRef}
          className={`${styles.video} ${!scanning ? styles.hidden : ''}`}
          playsInline
          muted
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
            {processing && (
              <div className={styles.processingBadge}>Processing…</div>
            )}
          </div>
        )}

        {!scanning && (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon}>📷</span>
            <p>Camera inactive</p>
          </div>
        )}
      </div>

      {result && (
        <div className={`${styles.resultCard} ${result.status === 'active' ? styles.success : styles.warn}`}>
          {result.status === 'active' ? (
            <>
              <span className={styles.resultIcon}>✓</span>
              <div>
                <div className={styles.resultName}>{result.user_name}</div>
                <div className={styles.resultDetail}>Checked in to {result.event_title}</div>
              </div>
            </>
          ) : (
            <>
              <span className={styles.resultIcon}>⚠</span>
              <div>
                <div className={styles.resultName}>Ticket {result.status}</div>
                <div className={styles.resultDetail}>
                  {result.status === 'used'
                    ? `Already checked in at ${new Date(result.checked_in_at!).toLocaleTimeString()}`
                    : `Ticket is ${result.status}`}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div className={styles.errorCard}>{error}</div>}

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

      <div className={styles.manual}>
        <p className={styles.manualLabel}>Or enter ticket code manually:</p>
        <form className={styles.manualForm} onSubmit={handleManualEntry}>
          <input
            name="code"
            className={styles.manualInput}
            placeholder="Ticket code…"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={styles.manualBtn} disabled={processing}>
            Check In
          </button>
        </form>
      </div>
    </div>
  );
}
