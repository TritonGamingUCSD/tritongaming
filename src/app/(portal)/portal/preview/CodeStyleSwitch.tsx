'use client';

import Button from '@/components/ui/Button';
import { setCodeStyle, useCodeStyle } from '@/lib/ui/useCodeStyle';
import styles from './preview.module.css';

// Chooses which code THIS device draws for the person's own ticket, meeting code and reward pickup (kept in this browser only; nobody else is affected, and the Scan page reads both).
export default function CodeStyleSwitch() {
  const style = useCodeStyle();
  return (
    <section className={styles.switch} aria-label="Code style on this device">
      <div>
        <strong>My Codes On This Device</strong>
        <p className={styles.note}>
          Shows your own ticket, meeting code and reward pickup as {style === 'byte' ? 'a Bytecode (Byte)' : 'a TGcode'} on this phone or laptop only. Everyone else keeps the
          TGcode, and the Scan page reads both.
        </p>
      </div>
      <div className={styles.bar}>
        <Button variant={style === 'tg' ? 'primary' : 'secondary'} onClick={() => setCodeStyle('tg')} aria-pressed={style === 'tg'}>
          TGcode
        </Button>
        <Button variant={style === 'byte' ? 'primary' : 'secondary'} onClick={() => setCodeStyle('byte')} aria-pressed={style === 'byte'}>
          Bytecode
        </Button>
      </div>
    </section>
  );
}
