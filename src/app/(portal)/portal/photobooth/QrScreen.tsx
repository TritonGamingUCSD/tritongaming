'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Mail, Plus, X } from 'lucide-react';
import { DEFAULT_QR_OPTIONS } from '@/lib/qr/qrCodeStyling';
import { photoLink } from '@/lib/photobooth/booth';
import { call } from './api';
import { Confetti } from './Confetti';
import { StripPlayer, type StripPlayback } from './StripPlayer';
import styles from './photobooth.module.css';

const StyledQRCode = dynamic(() => import('@/components/StyledQRCode/StyledQRCode'), { ssr: false, loading: () => null }); // (the QR library needs the browser)

// The picture and the Triton Gaming QR code for its page, with the seconds left shown as a bar. A guest without a phone camera at hand can have the link emailed to them (the address is used once and never kept); the clock waits while they type.
// When the time is up (or Next Guest is pressed) the booth goes back to its welcome screen.
export function QrScreen({
  token,
  picture,
  playback,
  frameMs,
  seconds,
  test = false,
  onDone,
}: {
  token: string;
  picture: string;
  playback: StripPlayback | null;
  frameMs: number;
  seconds: number;
  test?: boolean;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const [emailing, setEmailing] = useState(false);
  const [emails, setEmails] = useState(['']); // one box for each person who wants the link
  const [sentTo, setSentTo] = useState(0); // how many have been emailed so far
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

  const filled = emails.map((e) => e.trim()).filter(Boolean);
  const send = async () => {
    if (!filled.length) return;
    setState('sending');
    setProblem('');
    const r = await call<{ sent: number; failed: string[] }>('/api/photobooth/photos/email', 'POST', { token, emails: filled });
    if (r.ok) {
      setSentTo((n) => n + r.data.sent);
      setLeft((n) => Math.max(n, 12)); // (a moment to read "Sent" before the booth moves on)
      if (r.data.failed.length) {
        // some did not go: keep just those boxes so they can be fixed or tried again
        setEmails(r.data.failed);
        setState('idle');
        setProblem(`Couldn’t send to ${r.data.failed.join(', ')}. Check the address and try again.`);
      } else {
        setState('sent');
        setEmailing(false);
      }
    } else {
      setState('idle');
      setProblem(r.error);
    }
  };

  return (
    <div className={styles.qrScreen}>
      <Confetti />
      <div className={`${styles.qrPicture} ${styles.dropIn}`}>
        {playback ? (
          <StripPlayer playback={playback} frameMs={frameMs} label="Your finished picture, moving" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="Your finished picture" />
        )}
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
            <h2 className={styles.qrTitle}>
              <span className={styles.mark}>Scan To Download</span>
            </h2>
            <p className={styles.qrText}>Point your phone’s camera at the code.</p>
            <div className={`${styles.qrCode} ${styles.popIn}`}>
              <StyledQRCode options={options} />
            </div>
            <div className={styles.qrBar} aria-hidden="true">
              <span style={{ width: `${emailing ? 100 : Math.max(0, (left / seconds) * 100)}%` }} />
            </div>
            {state === 'sent' && !emailing ? (
              <div className={styles.emailRow}>
                <p className={styles.sent} role="status">
                  Sent to {sentTo} {sentTo === 1 ? 'email' : 'emails'}! Check your inbox.
                </p>
                <button
                  type="button"
                  className={`${styles.ghostBtn} ${styles.emailOpen}`}
                  onClick={() => {
                    setEmails(['']);
                    setState('idle');
                    setEmailing(true);
                  }}
                >
                  <Mail size={20} aria-hidden="true" /> Email Someone Else
                </button>
              </div>
            ) : emailing ? (
              <form
                className={styles.emailRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                {emails.map((value, i) => (
                  <div key={i} className={styles.emailFields}>
                    <input
                      className={styles.emailInput}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      autoFocus={i === emails.length - 1}
                      placeholder="you@example.com"
                      value={value}
                      maxLength={200}
                      onChange={(e) => setEmails((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                      aria-label={emails.length > 1 ? `Email address ${i + 1}` : 'Your email address'}
                    />
                    {emails.length > 1 && (
                      <button
                        type="button"
                        className={styles.emailRemove}
                        onClick={() => setEmails((list) => list.filter((_, j) => j !== i))}
                        aria-label={`Remove email address ${i + 1}`}
                      >
                        <X size={20} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
                {emails.length < 6 && (
                  <button type="button" className={styles.linkBtn2} onClick={() => setEmails((list) => [...list, ''])}>
                    <Plus size={16} aria-hidden="true" /> Add Another Person
                  </button>
                )}
                <button type="submit" className={`${styles.bigBtn} ${styles.emailSend}`} disabled={state === 'sending' || !filled.length}>
                  {state === 'sending' ? 'Sending…' : filled.length > 1 ? `Send To ${filled.length} People` : 'Send'}
                </button>
                {problem && <p className={styles.problem}>{problem}</p>}
                <p className={styles.fine}>Everyone gets their own email. We use the addresses once to send this link and don’t keep them.</p>
                <button
                  type="button"
                  className={styles.linkBtn2}
                  onClick={() => {
                    setEmailing(false);
                    setProblem('');
                    if (sentTo) setState('sent');
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className={`${styles.ghostBtn} ${styles.emailOpen}`} onClick={() => setEmailing(true)}>
                <Mail size={20} aria-hidden="true" /> Email Me The Link
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
