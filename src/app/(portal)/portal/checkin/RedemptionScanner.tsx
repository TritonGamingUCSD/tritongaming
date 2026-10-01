'use client';

import Notice from '@/components/ui/Notice';
import { useState } from 'react';
import { Camera, Gift, Check, X } from 'lucide-react';
import { useQRScanner } from '@/lib/useQRScanner';
import styles from './checkinsection.module.css';
// Same viewport/placeholder/scan-box treatment as CheckInClient's camera —
// imported rather than duplicated so the two scanners can't visually drift
// apart again. CheckInClient itself isn't touched (see useQRScanner.ts).
import checkinStyles from './checkin.module.css';

interface RedemptionDetail {
  id: string;
  status: string;
  point_cost: number;
  reward: { title: string; description: string | null } | { title: string; description: string | null }[] | null;
  member: { display_name: string | null } | { display_name: string | null }[] | null;
}

function oneOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Scans a member's redemption QR (see PointsSectionContent's claim flow),
// shows what to hand over, and confirms it — same "identify, then confirm"
// two-step shape as the ticket scanner, so an officer never marks
// something given away just because a camera happened to see a code.
export default function RedemptionScanner() {
  const [detail, setDetail] = useState<RedemptionDetail | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  async function handleScan(redemptionId: string) {
    setError('');
    try {
      const res = await fetch(`/api/rewards/redemptions/${redemptionId}/confirm`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Redemption not found.'); return; }
      setDetail(json.redemption);
    } catch {
      setError('Network error looking up that code.');
    }
  }

  const scanner = useQRScanner(handleScan);

  async function handleConfirm() {
    if (!detail) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch(`/api/rewards/redemptions/${detail.id}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to confirm.'); return; }
      const reward = oneOf(detail.reward);
      const member = oneOf(detail.member);
      setDetail(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className={styles.scannerPage}>
      <div className={checkinStyles.scannerCard}>
        <div className={checkinStyles.viewport}>
          <video
            ref={scanner.videoRef}
            className={`${checkinStyles.video} ${!scanner.scanning ? checkinStyles.hidden : ''}`}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={scanner.canvasRef} className={checkinStyles.canvas} />

          {scanner.scanning && (
            <div className={checkinStyles.overlay}>
              <div className={checkinStyles.scanBox} />
            </div>
          )}

          {!scanner.scanning && (
            <div className={checkinStyles.placeholder} onClick={scanner.startCamera} role="button" tabIndex={0}>
              <span className={checkinStyles.placeholderIcon}><Camera size={40} strokeWidth={1.25} aria-hidden="true" /></span>
              <p className={checkinStyles.placeholderText}>Tap to Start Scanner</p>
              <p className={checkinStyles.placeholderEvent}>Scan a member&apos;s redemption code</p>
            </div>
          )}
        </div>
      </div>

      <div className={checkinStyles.controls}>
        {!scanner.scanning ? (
          <button type="button" className={checkinStyles.startBtn} onClick={scanner.startCamera}>
            Start Camera
          </button>
        ) : (
          <button type="button" className={checkinStyles.stopBtn} onClick={scanner.stopCamera}>
            Stop Camera
          </button>
        )}
      </div>

      {scanner.error && <Notice tone="error">{scanner.error}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {detail && (
        <div className={styles.confirmCard}>
          <Gift size={24} strokeWidth={1.5} aria-hidden="true" />
          <h3 className={styles.confirmTitle}>{oneOf(detail.reward)?.title ?? 'Reward'}</h3>
          <p className={styles.confirmMeta}>For {oneOf(detail.member)?.display_name ?? 'Member'} · {detail.point_cost} pts</p>
          {detail.status !== 'pending' ? (
            <Notice tone="error">Already {detail.status}.</Notice>
          ) : (
            <div className={styles.confirmActions}>
              <button type="button" className={styles.rejectBtn} onClick={() => setDetail(null)}><X size={15} strokeWidth={2} aria-hidden="true" /> Cancel</button>
              <button type="button" className={styles.confirmBtn} onClick={handleConfirm} disabled={confirming}>
                <Check size={15} strokeWidth={2} aria-hidden="true" /> {confirming ? 'Confirming…' : 'Confirm Given'}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
