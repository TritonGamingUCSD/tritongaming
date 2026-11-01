'use client';

import { useState } from 'react';
import { Camera, Check } from 'lucide-react';
import type { CameraChoice } from './useCamera';
import styles from './photobooth.module.css';

// Which camera the booth uses on this computer (a built-in camera, a webcam, or a mirrorless camera through a capture card). The choice is remembered on this computer. Only offered on the welcome screen.
export function CameraMenu({ cameras, current, onChoose }: { cameras: CameraChoice[]; current: string; onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (cameras.length < 2) return null;
  return (
    <div className={styles.cameraMenu}>
      <button type="button" className={`${styles.exit} ${styles.cameraBtn}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Choose the camera">
        <Camera size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className={styles.cameraList} role="menu">
          {cameras.map((c) => (
            <li key={c.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={c.id === current}
                className={styles.cameraItem}
                onClick={() => {
                  onChoose(c.id);
                  setOpen(false);
                }}
              >
                <span>{c.label}</span>
                {c.id === current && <Check size={16} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
