'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { UserRole } from '@/types/database';
import styles from './PendingRequests.module.css';

interface Request {
  id: string;
  requested_role: UserRole;
  message: string | null;
  status: string;
  created_at: string;
  user: { id: string; display_name: string | null; avatar_url: string | null } | null;
}

export default function PendingRequests({ requests: initial }: { requests: Request[] }) {
  const [requests, setRequests] = useState(initial);
  const [processing, setProcessing] = useState<string | null>(null);

  async function handle(req: Request, approve: boolean) {
    if (!req.user) return;
    setProcessing(req.id);

    // If approving, update role via admin API
    if (approve) {
      await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: req.user.id, role: req.requested_role }),
      });
    }

    await fetch('/api/admin/requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: req.id, status: approve ? 'approved' : 'rejected' }),
    });

    setRequests((r) => r.filter((x) => x.id !== req.id));
    setProcessing(null);
  }

  if (requests.length === 0) {
    return (
      <div className={styles.empty}>
        <span>✓</span> No pending requests
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {requests.map((req) => {
        const user = Array.isArray(req.user) ? req.user[0] : req.user;
        return (
          <div key={req.id} className={styles.row}>
            <div className={styles.userInfo}>
              {user?.avatar_url ? (
                <Image src={user.avatar_url} alt="" width={40} height={40} className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}
                  style={{ background: ROLE_COLORS[req.requested_role] }}>
                  {(user?.display_name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className={styles.meta}>
                <span className={styles.name}>{user?.display_name || 'Anonymous'}</span>
                <div className={styles.request}>
                  Requesting{' '}
                  <span className={styles.rolePill}
                    style={{ background: ROLE_COLORS[req.requested_role] + '22', color: ROLE_COLORS[req.requested_role] }}>
                    {ROLE_LABELS[req.requested_role]}
                  </span>
                </div>
                {req.message && <div className={styles.message}>"{req.message}"</div>}
              </div>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.approveBtn}
                disabled={!!processing}
                onClick={() => handle(req, true)}
              >
                {processing === req.id ? '…' : 'Approve'}
              </button>
              <button
                className={styles.rejectBtn}
                disabled={!!processing}
                onClick={() => handle(req, false)}
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
