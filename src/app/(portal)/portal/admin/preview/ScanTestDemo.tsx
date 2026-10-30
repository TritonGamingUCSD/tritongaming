'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Bytecode from '@/components/Bytecode/Bytecode';
import TGcode from '@/components/TGcode/TGcode';
import QrScanner from '../../meetings/QrScanner';
import styles from './preview.module.css';

const SAMPLE = 't00ffeeddccbb';

// What the scanner read, in words. A code the portal reads is `tg:` and a kind letter and its key (8 digits; 12 in the first TGcode format).
function describe(text: string, bytecode: boolean): string {
  const m = text.match(/^tg:([mtr])([0-9a-f]{8,12})$/);
  if (!m) return /^https?:/.test(text) ? `A link: ${text}` : `Something else: ${text}`;
  const what = m[1] === 'm' ? 'a meeting check-in' : m[1] === 't' ? 'a ticket' : 'a reward pickup';
  const kind = bytecode ? 'Bytecode' : m[2].length === 8 ? 'TGcode' : 'TGcode (first format)';
  return `${kind}: ${what}, key ${m[2]}`;
}

// A dry run of scanning: the real camera and the real reader, Byte's pop-up and the ring, but nothing is sent anywhere (nobody is checked in, nothing is saved or notified).
export default function ScanTestDemo() {
  const [open, setOpen] = useState(false);
  const [got, setGot] = useState<string | null>(null);
  const [byte, setByte] = useState(false);
  return (
    <div className={styles.stage}>
      <p className={styles.note}>
        Open the scanner and point it at a code on another screen: the two samples below, or a real ticket, meeting code or reward on someone else’s phone or laptop. It tells you
        what it read and plays the same animation a real scan would. Nothing is sent: nobody is checked in, nothing is saved.
      </p>
      <div className={styles.bar}>
        <Button onClick={() => setOpen(true)}>Open The Test Scanner</Button>
      </div>
      <div className={styles.cards}>
        <figure className={styles.card}>
          <div className={styles.box}>
            <Bytecode payload={`${SAMPLE}`} />
          </div>
          <figcaption>Sample Bytecode</figcaption>
        </figure>
        <figure className={styles.card}>
          <div className={styles.box}>
            <TGcode payload={`${SAMPLE}`} />
          </div>
          <figcaption>Sample TGcode</figcaption>
        </figure>
      </div>
      {open && (
        <QrScanner
          title="Test Scan: Nothing Is Saved"
          onScan={(text, how) => {
            setGot(text);
            setByte(!!how?.bytecode);
            return true;
          }}
          onClose={() => {
            setOpen(false);
            setGot(null);
          }}
          lock={got ? { tone: 'ok' } : null}
          sheetKey={got ?? ''}
          sheet={
            got ? (
              <div className={styles.testSheet}>
                <strong>Read: {describe(got, byte)}</strong>
                <span>Dry run: nothing was sent.</span>
                <Button onClick={() => setGot(null)}>Scan Next</Button>
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}
