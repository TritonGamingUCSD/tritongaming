'use client';

import { useState } from 'react';
import Bytecode from '@/components/Bytecode/Bytecode';
import TGcode from '@/components/TGcode/TGcode';
import { PAYLOAD } from '@/lib/qr/byteCode/layout';
import styles from './bytecode.module.css';

const SAMPLES = ['t00ffeeddccbb', 'm0123456789ab', 'rabcdefabcdef'];

export default function BytecodePreview() {
  const [payload, setPayload] = useState(SAMPLES[0]);
  const valid = PAYLOAD.test(payload);
  return (
    <div className={styles.page}>
      <h1>Bytecode Preview</h1>
      <p className={styles.note}>The same message as the TGcode, written across Byte’s belly. Pick a sample or type 13 characters: m, t or r, then 12 of 0–9 and a–f.</p>
      <div className={styles.row}>
        {SAMPLES.map((s) => (
          <button key={s} type="button" className={s === payload ? styles.on : ''} onClick={() => setPayload(s)}>
            {s}
          </button>
        ))}
        <input value={payload} onChange={(e) => setPayload(e.target.value.toLowerCase())} maxLength={13} spellCheck={false} aria-label="Code text" aria-invalid={!valid} />
      </div>
      <div className={styles.pair}>
        <figure>
          <div className={styles.box}>{valid ? <Bytecode payload={payload} /> : <p>Not a valid code</p>}</div>
          <figcaption>Bytecode</figcaption>
        </figure>
        <figure>
          <div className={styles.box}>{valid ? <TGcode payload={payload} /> : <p>Not a valid code</p>}</div>
          <figcaption>TGcode (kept as it is)</figcaption>
        </figure>
      </div>
    </div>
  );
}
