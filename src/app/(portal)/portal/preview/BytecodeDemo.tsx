'use client';

import { useState } from 'react';
import Bytecode from '@/components/Bytecode/Bytecode';
import TGcode from '@/components/TGcode/TGcode';
import { PAYLOAD } from '@/lib/qr/byteCode/layout';
import ThemePair from './ThemePair';
import styles from './bytecode.module.css';

const SAMPLES = ['t00ffeeddccbb', 'm0123456789ab', 'rabcdefabcdef'];

// The sample picker and the code box shared by the two code previews.
function CodePreview({ title, render }: { title: string; render: (payload: string) => React.ReactNode }) {
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
      <ThemePair>{valid ? render(payload) : <p>Not a valid code</p>}</ThemePair>
      <p className={styles.note}>{title}</p>
    </div>
  );
}

export default function BytecodeDemo() {
  return <CodePreview title="Bytecode" render={(p) => <Bytecode payload={p} />} />;
}

export function TGcodeDemo() {
  return <CodePreview title="TGcode (what tickets, meetings and rewards show today)" render={(p) => <TGcode payload={p} />} />;
}
