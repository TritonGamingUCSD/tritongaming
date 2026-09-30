'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import AsFormButton from './AsFormButton';
import styles from './tickets.module.css';

// The member-facing half of online self-check-in — see
// portal/checkin/OnlineCheckinPanel.tsx for the officer-facing code reveal
// this verifies against, and api/checkin/online for why this only works
// for an event you already hold an active ticket for (that's the actual
// anti-sharing mechanism, not the code's rotation).
//
// Rendered inline wherever a ticket for an online event already sits in
// the UI (the hero card, a ticket row) rather than as a separate global
// "got a code?" toggle — the event is already known from context, so there's
// no dropdown to pick it from, just the code itself.
export default function OnlineCheckinEntry({
  ticketId,
  eventId,
  onCheckedIn,
  compact = false,
  checkinFormUrl,
  onFormComplete,
}: {
  ticketId: string;
  eventId: string;
  onCheckedIn: (ticketId: string, checkedInAt: string) => void;
  compact?: boolean;
  // Pre-built server-side (see getTicketsData) for events with "Requires
  // UCSD check-in form" turned on — null/undefined for every other event.
  checkinFormUrl?: string | null;
  // Mirrors a confirmed completion into the shared tickets list (see
  // TicketsClient's handleFormCompleted) — this component's own local
  // `formCompleted` state doesn't survive if a status change elsewhere
  // causes it to unmount, so the parent needs to know too.
  onFormComplete?: (ticketId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formCompleted, setFormCompleted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/checkin/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, code: code.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to check in.'); return; }
      onCheckedIn(ticketId, new Date().toISOString());
      setSuccess(true);
      setCode('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className={styles.onlineCheckinFormWrap}>
        <div className={styles.onlineCheckinSuccess}>
          <Check size={16} strokeWidth={1.75} aria-hidden="true" /> You're checked in!
        </div>
        {checkinFormUrl && (
          <AsFormButton
            ticketId={ticketId}
            url={checkinFormUrl}
            opened={formCompleted}
            onOpened={() => { setFormCompleted(true); onFormComplete?.(ticketId); }}
          />
        )}
      </div>
    );
  }

  return (
    <form className={`${styles.onlineCheckinForm} ${compact ? styles.onlineCheckinFormCompact : ''}`} onSubmit={handleSubmit}>
      <input
        className={styles.onlineCheckinInput}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={compact ? 'Code' : 'Check-in code'}
        maxLength={6}
        required
      />
      <button type="submit" className={styles.onlineCheckinSubmit} disabled={submitting || !code.trim()}>
        {submitting ? 'Checking in…' : 'Check In'}
      </button>
      {error && <p className={styles.onlineCheckinError}>{error}</p>}
    </form>
  );
}
