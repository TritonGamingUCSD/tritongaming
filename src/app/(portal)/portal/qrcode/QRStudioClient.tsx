'use client';

import { useRef, useState } from 'react';
import StyledQRCode, { type StyledQRCodeHandle } from '@/components/StyledQRCode/StyledQRCode';
import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qrCodeStyling';
import QRStudioForm from './QRStudioForm';
import styles from './qrstudio.module.css';

const PLACEHOLDER_URL = 'https://www.example.com';

export interface QRDivisionLogo { id: string; name: string; logo: string }

export default function QRStudioClient({ divisions = [] }: { divisions?: QRDivisionLogo[] }) {
  // Starts empty (the field shows example.com as a placeholder, so nothing has to be deleted first).
  // The preview draws a sample code from the placeholder until a real link is entered.
  const [options, setOptions] = useState<QRCodeOptions>({ ...DEFAULT_QR_OPTIONS, data: '' });
  const hasData = options.data.trim().length > 0;
  const previewOptions = hasData ? options : { ...options, data: PLACEHOLDER_URL };
  const qrRef = useRef<StyledQRCodeHandle>(null);

  async function handleDownload() {
    await qrRef.current?.download(`${options.data.trim() || 'qr-code'}-${options.size}x${options.size}`);
  }

  return (
    <div className={styles.layout}>
      <QRStudioForm options={options} setOptions={setOptions} divisions={divisions} />

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
          <StyledQRCode ref={qrRef} options={previewOptions} className={styles.canvasInner} />
          {!hasData && <span className={styles.sampleTag}>Sample — enter a link to make yours</span>}
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

        <button className={styles.downloadBtn} onClick={handleDownload} disabled={!hasData || options.size <= 0}>
          Download {options.downloadFormat.toUpperCase()}
        </button>
      </aside>
    </div>
  );
}
