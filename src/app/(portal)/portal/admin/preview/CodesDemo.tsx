'use client';

import { useState } from 'react';
import Bytecode from '@/components/Bytecode/Bytecode';
import dynamic from 'next/dynamic';
import TGcode from '@/components/TGcode/TGcode';
import { PAYLOAD } from '@/lib/qr/byteCode/layout';
import ThemePair from './ThemePair';
import styles from './codes.module.css';

const PortalQr = dynamic(() => import('@/components/portal/PortalQr'), { ssr: false, loading: () => null }); // (the QR library needs the browser)

const SAMPLES = ['t00ffeeddccbb', 'm0123456789ab', 'rabcdefabcdef'];

// The three codes a ticket, a meeting's check-in and a reward pickup can be drawn as, side by side (light and dark at once), with one shared sample: pick one or type 13 characters.
export default function CodesDemo() {
  const [payload, setPayload] = useState(SAMPLES[0]);
  const valid = PAYLOAD.test(payload);
  return (
    <div className={styles.page}>
      <p className={styles.note}>Pick a sample or type 13 characters: m, t or r, then 12 of 0–9 and a–f.</p>
      <div className={styles.row}>
        {SAMPLES.map((s) => (
          <button key={s} type="button" className={s === payload ? styles.on : ''} onClick={() => setPayload(s)}>
            {s}
          </button>
        ))}
        <input value={payload} onChange={(e) => setPayload(e.target.value.toLowerCase())} maxLength={13} spellCheck={false} aria-label="Code text" aria-invalid={!valid} />
      </div>
      <ThemePair>
        {valid ? (
          <div className={styles.three}>
            <figure>
              <TGcode payload={payload} />
              <figcaption>TGcode</figcaption>
            </figure>
            <figure>
              <Bytecode payload={payload} />
              <figcaption>Bytecode</figcaption>
            </figure>
            <figure>
              <PortalQr payload={payload} />
              <figcaption>QR code</figcaption>
            </figure>
          </div>
        ) : (
          <p>Not a valid code</p>
        )}
      </ThemePair>
    </div>
  );
}
