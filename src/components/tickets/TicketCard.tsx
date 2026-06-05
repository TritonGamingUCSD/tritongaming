'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { TicketStatus } from '@/types/database';
import QRCode from './QRCode';
import styles from './TicketCard.module.css';

interface TicketData {
  id: string;
  ticket_code: string;
  status: TicketStatus;
  checked_in_at: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    flyer_url: string | null;
  } | null;
}

export default function TicketCard({ ticket }: { ticket: TicketData }) {
  const [expanded, setExpanded] = useState(false);
  const event = ticket.event;
  const startDate = event ? new Date(event.start_date) : null;

  const statusColors: Record<TicketStatus, string> = {
    active: '#059669',
    used: '#6b7280',
    cancelled: '#dc2626',
    expired: '#d97706',
  };

  const statusLabels: Record<TicketStatus, string> = {
    active: 'Active',
    used: 'Checked In',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };

  return (
    <div className={`${styles.card} ${ticket.status === 'used' ? styles.used : ''}`}>
      <div className={styles.header}>
        {event?.flyer_url && (
          <div className={styles.flyerThumb}>
            <Image
              src={event.flyer_url}
              alt={event.title || ''}
              width={60}
              height={60}
              className={styles.flyer}
            />
          </div>
        )}
        <div className={styles.info}>
          <h3 className={styles.eventTitle}>{event?.title || 'Unknown Event'}</h3>
          {startDate && (
            <p className={styles.date}>
              {startDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              {' '}
              {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          {event?.location && <p className={styles.location}>{event.location}</p>}
        </div>
        <span
          className={styles.statusBadge}
          style={{ background: statusColors[ticket.status] + '22', color: statusColors[ticket.status] }}
        >
          {statusLabels[ticket.status]}
        </span>
      </div>

      <div className={styles.divider} />

      <div className={styles.footer}>
        <span className={styles.code}># {ticket.ticket_code.substring(0, 8).toUpperCase()}</span>
        {ticket.status === 'active' && (
          <button
            className={styles.qrToggle}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide QR' : 'Show QR Code'}
          </button>
        )}
        {ticket.checked_in_at && (
          <span className={styles.checkedIn}>
            ✓ Checked in {new Date(ticket.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </div>

      {expanded && ticket.status === 'active' && (
        <div className={styles.qrSection}>
          <QRCode value={ticket.ticket_code} size={200} />
          <p className={styles.qrHint}>Show this to event staff at check-in</p>
        </div>
      )}
    </div>
  );
}
