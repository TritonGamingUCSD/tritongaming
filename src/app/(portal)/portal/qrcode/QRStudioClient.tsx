'use client';

import { useRef, useState } from 'react';
import StyledQRCode, { type StyledQRCodeHandle } from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qrCodeStyling';
import QRStudioForm from './QRStudioForm';
import styles from './qrstudio.module.css';

export default function QRStudioClient() {
  const [options, setOptions] = useState<QRCodeOptions>(DEFAULT_QR_OPTIONS);
  const qrRef = useRef<StyledQRCodeHandle>(null);

  async function handleDownload() {
    await qrRef.current?.download(`${options.data.trim() || 'qr-code'}-${options.size}x${options.size}`);
  }

  return (
    <div className={styles.layout}>
      <QRStudioForm options={options} setOptions={setOptions} />

      <aside className={styles.previewPanel}>
        <div>
          <p className={styles.eyebrow}>Preview</p>
          <h2 className={styles.previewTitle}>Live output</h2>
          <p className={styles.previewHint}>
            Updates instantly as you tune the settings. Download PNG or JPEG when you&apos;re ready.
          </p>
        </div>

        <div
          className={styles.canvasFrame}
          style={
            options.transparentBg
              ? { backgroundImage: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%)', backgroundSize: '20px 20px' }
              : { backgroundColor: '#fff' }
          }
        >
          <StyledQRCode ref={qrRef} options={options} className={styles.canvasInner} />
        </div>

        <div className={styles.statRow}>
          <div className={styles.statBox}>
            <p className={styles.statLabel}>Canvas</p>
            <p className={styles.statValue}>{options.size}px</p>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statLabel}>Icon</p>
            <p className={styles.statValue}>{options.icon.replace('-', ' ')}</p>
          </div>
        </div>

        <button className={styles.downloadBtn} onClick={handleDownload} disabled={!options.data.trim() || options.size <= 0}>
          Download {options.downloadFormat.toUpperCase()}
        </button>
      </aside>
    </div>
  );
}
