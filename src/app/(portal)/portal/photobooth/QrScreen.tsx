'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { photoLink } from '@/lib/photobooth/booth';
import { call } from './api';
import { Confetti } from './Confetti';
import styles from './photobooth.module.css';

const StyledQRCode = dynamic(() => import('@/components/StyledQRCode/StyledQRCode'), { ssr: false, loading: () => null }); // (the QR library needs the browser)

// The picture and the Triton Gaming QR code for its page, with the seconds left shown as a bar. A guest without a phone camera at hand can have the link emailed to them (the address is used once and never kept); the clock waits while they type.
// When the time is up (or Next Guest is pressed) the booth goes back to its welcome screen.
export function QrScreen({ token, picture, seconds, test = false, onDone }: { token: string; picture: string; seconds: number; test?: boolean; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [emailing, setEmailing] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [problem, setProblem] = useState('');
  useEffect(() => {
    if (emailing || test) return; // (a test run waits for its button)
    const id = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(id);
  }, [emailing, test]);
  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);
  const options = useMemo(() => ({ ...DEFAULT_QR_OPTIONS, data: photoLink(token, window.location.origin), size: 560, margin: 10 }), [token]);

  const send = async () => {
    setState('sending');
    setProblem('');
    const r = await call('/api/photobooth/photos/email', 'POST', { token, email });
    if (r.ok) {
      setState('sent');
      setEmailing(false);
      setLeft((n) => Math.max(n, 12)); // (a moment to read "Sent" before the booth moves on)
    } else {
      setState('idle');
      setProblem(r.error);
    }
  };

  return (
    <div className={styles.qrScreen}>
      <Confetti />
      <div className={`${styles.qrPicture} ${styles.dropIn}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={picture} alt="Your finished picture" />
      </div>
      <div className={`${styles.qrSide} ${styles.riseIn}`}>
        {test ? (
          <>
            <h2 className={styles.qrTitle}>That Was A Test</h2>
            <p className={styles.qrText}>Nothing was saved or uploaded. A real guest would see a QR code here to download their picture.</p>
            <button type="button" className={styles.bigBtn} onClick={onDone}>
              Test Again
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.qrTitle}>Scan To Download</h2>
            <p className={styles.qrText}>Point your phone’s camera at the code.</p>
            <div className={`${styles.qrCode} ${styles.popIn}`}>
              <StyledQRCode options={options} />
            </div>
            <div className={styles.qrBar} aria-hidden="true">
              <span style={{ width: `${emailing ? 100 : Math.max(0, (left / seconds) * 100)}%` }} />
            </div>
            {state === 'sent' ? (
              <p className={styles.sent} role="status">
                Sent! Check your email.
              </p>
            ) : emailing ? (
              <form
                className={styles.emailRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (email.trim()) void send();
                }}
              >
                <input
                  className={styles.emailInput}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  maxLength={200}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Your email address"
                />
                <button type="submit" className={styles.bigBtn} disabled={state === 'sending' || !email.trim()}>
                  {state === 'sending' ? 'Sending…' : 'Send'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={() => setEmailing(false)}>
                  Cancel
                </button>
                {problem && <p className={styles.problem}>{problem}</p>}
                <p className={styles.fine}>We use your address once to send this link and don’t keep it.</p>
              </form>
            ) : (
              <button type="button" className={styles.ghostBtn} onClick={() => setEmailing(true)}>
                Email Me The Link
              </button>
            )}
            <button type="button" className={styles.bigBtn} onClick={onDone}>
              Next Guest
            </button>
          </>
        )}
      </div>
    </div>
  );
}
