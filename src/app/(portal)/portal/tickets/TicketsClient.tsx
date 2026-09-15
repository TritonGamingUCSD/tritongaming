'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FullscreenQR from './FullscreenQR';
import styles from './tickets.module.css';

interface TicketData {
  id: string;
  ticket_code: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
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

interface UpcomingEvent {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  requires_ticket: boolean;
  ticket_price: number;
  audience: 'public' | 'ucsd_only';
}

interface Props {
  tickets: TicketData[];
  upcomingEvents: UpcomingEvent[];
  isUcsd: boolean;
}

const STATUS_ICON: Record<string, string> = {
  active: '🎟️', used: '✓', cancelled: '✗', expired: '⏱',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

export default function TicketsClient({ tickets, upcomingEvents, isUcsd }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qrTicket, setQrTicket] = useState<TicketData | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const checkoutResult = searchParams.get('checkout');

  // The Stripe webhook that creates the paid ticket runs async, so it may not
  // have landed yet when Stripe redirects back here. Give it a couple of
  // chances to show up.
  useEffect(() => {
    if (checkoutResult !== 'success') return;
    const t1 = setTimeout(() => router.refresh(), 2000);
    const t2 = setTimeout(() => router.refresh(), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [checkoutResult, router]);

  async function handleGetTicket(eventId: string) {
    setError('');
    setPurchasing(eventId);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setPurchasing(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(null);
    }
  }

  const activeTickets = tickets.filter((t) => t.status === 'active');
  const pastTickets   = tickets.filter((t) => t.status !== 'active');

  const now = new Date();
  const nextActiveTicket = activeTickets.find((t) => {
    const ev = t.event;
    return ev && new Date(ev.start_date) >= now;
  });

  // Events the user hasn't registered for yet
  const registeredEventIds = new Set(tickets.map((t) => t.event?.id).filter(Boolean));
  const unregisteredEvents = upcomingEvents.filter((e) => !registeredEventIds.has(e.id));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Tickets</h1>

      {checkoutResult === 'success' && (
        <div className={styles.checkoutBanner}>
          ✓ Payment received — your ticket will appear here in a few seconds.
        </div>
      )}
      {checkoutResult === 'cancelled' && (
        <div className={styles.checkoutBannerWarn}>
          Checkout was cancelled — no charge was made.
        </div>
      )}
      {error && <div className={styles.checkoutBannerWarn}>{error}</div>}

      {/* Hero: next active ticket */}
      {nextActiveTicket && (
        <section className={styles.heroSection}>
          <div className={styles.heroCard}>
            <div className={styles.heroCardInner}>
              <div className={styles.heroMeta}>
                <span className={styles.heroLabel}>NEXT EVENT</span>
                <h2 className={styles.heroEvent}>{nextActiveTicket.event?.title}</h2>
                {nextActiveTicket.event?.start_date && (
                  <p className={styles.heroDate}>
                    {new Date(nextActiveTicket.event.start_date).toLocaleDateString('en-US', {
                      weekday: 'short', month: 'long', day: 'numeric',
                    })}
                    {' · '}
                    {new Date(nextActiveTicket.event.start_date).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
                {nextActiveTicket.event?.location && (
                  <p className={styles.heroLocation}>📍 {nextActiveTicket.event.location}</p>
                )}
              </div>
              <button
                className={styles.showQrBtn}
                onClick={() => setQrTicket(nextActiveTicket)}
              >
                <span className={styles.showQrIcon}>📱</span>
                Show QR Code
              </button>
            </div>
            <div className={styles.heroGlow} aria-hidden="true" />
          </div>
        </section>
      )}

      {/* All active tickets */}
      {activeTickets.length > 0 && (
        <section>
          {activeTickets.length > 1 && (
            <h2 className={styles.sectionTitle}>Active Tickets</h2>
          )}
          <div className={styles.ticketList}>
            {activeTickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onShowQR={() => setQrTicket(ticket)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events to register for */}
      {unregisteredEvents.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Upcoming Events</h2>
          <div className={styles.eventList}>
            {unregisteredEvents.map((event) => (
              <div key={event.id} className={styles.eventRow}>
                <div className={styles.eventDateBlock}>
                  <span className={styles.eventMon}>
                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className={styles.eventDay}>
                    {new Date(event.start_date).getDate()}
                  </span>
                </div>
                <div className={styles.eventBody}>
                  <div className={styles.eventTitle}>{event.title}</div>
                  {event.location && (
                    <div className={styles.eventLoc}>📍 {event.location}</div>
                  )}
                </div>
                {event.requires_ticket && (
                  event.audience === 'ucsd_only' && !isUcsd ? (
                    <span className={styles.registerBtnDisabled}>UCSD students only</span>
                  ) : (
                    <button
                      className={styles.registerBtn}
                      disabled={purchasing === event.id}
                      onClick={() => handleGetTicket(event.id)}
                    >
                      {purchasing === event.id
                        ? 'Please wait…'
                        : isUcsd || event.ticket_price <= 0
                        ? 'Get Ticket — Free'
                        : `Buy Ticket — $${event.ticket_price}`}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tickets.length === 0 && unregisteredEvents.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎟️</span>
          <p className={styles.emptyText}>No tickets yet</p>
          <p className={styles.emptyHint}>Register for events to get your tickets here.</p>
          <a href="/events" className={styles.browseLink}>Browse Events →</a>
        </div>
      )}

      {/* Past tickets */}
      {pastTickets.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Past Tickets</h2>
          <div className={styles.ticketList}>
            {pastTickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen QR overlay */}
      {qrTicket && (
        <FullscreenQR
          ticketCode={qrTicket.ticket_code}
          eventTitle={qrTicket.event?.title ?? 'Event'}
          onClose={() => setQrTicket(null)}
        />
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  onShowQR,
}: {
  ticket: TicketData;
  onShowQR?: () => void;
}) {
  const ev = ticket.event;
  return (
    <div className={`${styles.ticketRow} ${ticket.status !== 'active' ? styles.ticketDim : ''}`}>
      <div className={styles.ticketLeft}>
        <span className={styles.ticketStatusIcon}>{STATUS_ICON[ticket.status]}</span>
      </div>
      <div className={styles.ticketInfo}>
        <div className={styles.ticketEventName}>{ev?.title ?? 'Unknown Event'}</div>
        {ev?.start_date && (
          <div className={styles.ticketDate}>
            {new Date(ev.start_date).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            })}
          </div>
        )}
        {ticket.checked_in_at && (
          <div className={styles.checkedInLine}>
            ✓ Checked in {new Date(ticket.checked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
      </div>
      <div className={styles.ticketRight}>
        <span className={`${styles.statusBadge} ${styles[`status_${ticket.status}`]}`}>
          {STATUS_LABEL[ticket.status]}
        </span>
        {ticket.status === 'active' && onShowQR && (
          <button className={styles.qrMiniBtn} onClick={onShowQR} aria-label="Show QR code">
            QR
          </button>
        )}
      </div>
    </div>
  );
}
