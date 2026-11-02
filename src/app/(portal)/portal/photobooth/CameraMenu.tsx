'use client';

import { useState } from 'react';
import { Camera, Check } from 'lucide-react';
import type { CameraChoice, CameraInfo } from './useCamera';
import styles from './photobooth.module.css';

// Which camera the booth uses on this computer (a built-in camera, a webcam, or a mirrorless camera through a capture card), remembered on this computer, and a Camera Check of what the booth can tell about it: its name, the picture size and
// speed it gives and which settings the browser may change on it. A mirrorless camera through a capture card or in webcam mode usually has none, so its exposure and colour are set on the camera itself. Only offered on the welcome screen.
export function CameraMenu({ cameras, current, info, onChoose }: { cameras: CameraChoice[]; current: string; info: CameraInfo | null; onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!info && cameras.length < 2) return null;
  const small = !!info && info.width > 0 && info.width < 1280;
  return (
    <div className={styles.cameraMenu}>
      <button type="button" className={`${styles.exit} ${styles.cameraBtn}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Camera and camera check">
        <Camera size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.cameraList}>
          {cameras.length > 1 && (
            <ul className={styles.cameraChoices} role="menu">
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
          {info && (
            <div className={styles.cameraCheck}>
              <strong>Camera Check</strong>
              <p>{info.label}</p>
              <p>
                {info.width > 0 ? `${info.width} × ${info.height}` : 'Size unknown'}
                {info.fps > 0 ? ` at ${info.fps} pictures a second` : ''}
              </p>
              {small && <p className={styles.cameraWarn}>This is a small picture, so photos may look soft. Try a different camera or cable.</p>}
              {info.controls.length > 0 ? (
                <p>The browser can change: {info.controls.join(', ')}.</p>
              ) : (
                <p>The browser can&rsquo;t change this camera&rsquo;s exposure or colour. Set them on the camera itself; Auto-correct in the studio still evens out each photo.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
