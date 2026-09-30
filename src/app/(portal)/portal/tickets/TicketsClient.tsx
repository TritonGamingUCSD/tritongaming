'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Ticket, MapPin, QrCode, Check, X, Timer, Award, ClipboardList } from 'lucide-react';
import FullscreenQR from './FullscreenQR';
import OnlineCheckinEntry from './OnlineCheckinEntry';
import CheckinFormModal from './CheckinFormModal';
import AddToCalendarButton from '@/components/AddToCalendarButton/AddToCalendarButton';
import { PACIFIC_TZ } from '@/lib/timezone';
import { isCheckinWindowOpen } from '@/lib/checkinWindow';
import styles from './tickets.module.css';

interface TicketData {
  id: string;
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
    points_value?: number;
    is_online: boolean;
  } | null;
  // Pre-built server-side (see getTicketsData) — ready to render the
  // instant this ticket flips to checked-in, no extra fetch needed then.
  checkinFormUrl?: string | null;
  // Set once the ticket holder explicitly confirms they finished the AS
  // Form (see CheckinFormModal's "I've Completed This Form" button) — an
  // honor-system marker, not proof of an actual Google Forms submission.
  // Once set, the "Complete AS Form" button stops re-offering it.
  checkin_form_completed_at?: string | null;
}

interface UpcomingEvent {
  id: string;
  title: string;
  start_date: string;
  location: string | null;
  ticket_price: number;
  audience: 'public' | 'ucsd_only';
  points_value?: number;
  is_online?: boolean;
}

interface Props {
  tickets: TicketData[];
  upcomingEvents: UpcomingEvent[];
  isUcsd: boolean;
  // Rewards (points at check-in) is UCSD-students-and-staff only now —
  // see is_rewards_eligible() — so a guest/recruit/alumni holding a
  // ticket to a public event shouldn't see "+N pts on check-in" badges
  // promising points their check-in will never actually award.
  canEarnPoints: boolean;
}

const STATUS_ICON: Record<string, ReactNode> = {
  active: <Ticket size={18} strokeWidth={1.5} aria-hidden="true" />,
  used: <Check size={18} strokeWidth={1.75} aria-hidden="true" />,
  cancelled: <X size={18} strokeWidth={1.75} aria-hidden="true" />,
  expired: <Timer size={18} strokeWidth={1.5} aria-hidden="true" />,
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

export default function TicketsClient({ tickets: initialTickets, upcomingEvents, isUcsd, canEarnPoints }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState(initialTickets);
  const [qrTicket, setQrTicket] = useState<TicketData | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const checkoutResult = searchParams.get('checkout');

  // `tickets` is seeded from `initialTickets` only once (useState's
  // initializer runs on mount, not on every render) — router.refresh() below
  // re-fetches this page's server data and hands down a new `initialTickets`
  // array, but without this sync the local `tickets` state never picks it
  // up. That's what made a freshly-claimed free ticket (no Stripe redirect,
  // just router.refresh()) invisible: the fetch succeeded and the ticket
  // existed in the DB, but the UI kept rendering the pre-claim list.
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

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
        if (data.needsProfile) {
          router.push('/portal/profile?next=/portal/tickets');
          return;
        }
        setError(data.error || 'Something went wrong. Please try again.');
        setPurchasing(null);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.free && data.ticket) {
        // Show the QR immediately instead of making the user notice a new
        // "Show QR Code" button appeared after a background refresh — this
        // is the ticket they just claimed, they want it now. The API only
        // returns the bare tickets-table row (no event join), so stitch in
        // the event details we already have client-side from upcomingEvents.
        const event = upcomingEvents.find((e) => e.id === eventId);
        const newTicket: TicketData = {
          id: data.ticket.id,
          status: data.ticket.status,
          checked_in_at: data.ticket.checked_in_at,
          created_at: data.ticket.created_at,
          event: event ? { id: event.id, title: event.title, start_date: event.start_date, end_date: null, location: event.location, flyer_url: null, points_value: event.points_value, is_online: event.is_online ?? false } : null,
        };
        setTickets((prev) => [newTicket, ...prev]);
        setQrTicket(newTicket);
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPurchasing(null);
    }
  }

  // Reflects a live check-in (see FullscreenQR's Realtime subscription) into
  // the ticket list immediately, so closing the QR modal doesn't show a now-
  // stale "Active"/"Show QR" row until the next full page load.
  function handleCheckedIn(ticketId: string, checkedInAt: string) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: 'used', checked_in_at: checkedInAt } : t)));
  }

  // Same idea as handleCheckedIn above — reflects a completion confirmed
  // from FullscreenQR's own "I've Completed This Form" button into the
  // shared tickets list, so TicketRow's fallback (which reads this same
  // field) doesn't keep offering a form that was already confirmed done
  // somewhere else.
  function handleFormCompleted(ticketId: string) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, checkin_form_completed_at: new Date().toISOString() } : t)));
  }

  const activeTickets = tickets.filter((t) => t.status === 'active');
  const pastTickets   = tickets.filter((t) => t.status !== 'active');

  const now = new Date();
  // Tickets come back sorted by when they were registered, not by event date —
  // pick whichever active ticket's event starts soonest, not just the first
  // one in that list.
  const nextActiveTicket = activeTickets
    .filter((t) => t.event && new Date(t.event.start_date) >= now)
    .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())[0];

  // Don't repeat the ticket already featured in the hero card above.
  const otherActiveTickets = activeTickets.filter((t) => t.id !== nextActiveTicket?.id);

  // Events the user hasn't registered for yet
  const registeredEventIds = new Set(tickets.map((t) => t.event?.id).filter(Boolean));
  const unregisteredEvents = upcomingEvents.filter((e) => !registeredEventIds.has(e.id));

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>My Tickets</h1>

      {checkoutResult === 'success' && (
        <div className={styles.checkoutBanner}>
          <Check size={16} strokeWidth={1.75} aria-hidden="true" /> Payment received — your ticket will appear here in a few seconds.
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
            {nextActiveTicket.event?.id && (
              <AddToCalendarButton eventId={nextActiveTicket.event.id} className={styles.heroCalendarCorner} iconOnly />
            )}
            <div className={styles.heroCardInner}>
              <div className={styles.heroMeta}>
                <span className={styles.heroLabel}>NEXT EVENT</span>
                <h2 className={styles.heroEvent}>{nextActiveTicket.event?.title}</h2>
                {nextActiveTicket.event?.start_date && (
                  <p className={styles.heroDate}>
                    {new Date(nextActiveTicket.event.start_date).toLocaleDateString('en-US', {
                      timeZone: PACIFIC_TZ, weekday: 'short', month: 'long', day: 'numeric',
                    })}
                    {' · '}
                    {new Date(nextActiveTicket.event.start_date).toLocaleTimeString('en-US', {
                      timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
                {nextActiveTicket.event?.location && (
                  <p className={styles.heroLocation}><MapPin size={13} strokeWidth={1.5} aria-hidden="true" /> {nextActiveTicket.event.location}</p>
                )}
                {canEarnPoints && !!nextActiveTicket.event?.points_value && (
                  <span className={styles.heroPointsBadge}><Award size={12} strokeWidth={1.75} aria-hidden="true" /> +{nextActiveTicket.event.points_value} pts on check-in</span>
                )}
              </div>
              {nextActiveTicket.event?.is_online ? (
                <OnlineCheckinEntry
                  ticketId={nextActiveTicket.id}
                  eventId={nextActiveTicket.event.id}
                  onCheckedIn={handleCheckedIn}
                  checkinFormUrl={nextActiveTicket.checkinFormUrl}
                  onFormComplete={handleFormCompleted}
                />
              ) : (
                <button
                  className={styles.showQrBtn}
                  onClick={() => setQrTicket(nextActiveTicket)}
                >
                  <span className={styles.showQrIcon}><QrCode size={18} strokeWidth={1.5} aria-hidden="true" /></span>
                  Show QR Code
                </button>
              )}
            </div>
            <div className={styles.heroGlow} aria-hidden="true" />
          </div>
        </section>
      )}

      {/* Other active tickets — excludes whichever one is already shown in
          the hero above, so the same ticket never appears twice on screen. */}
      {otherActiveTickets.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>
            {nextActiveTicket ? 'Other Active Tickets' : 'Active Tickets'}
          </h2>
          <div className={styles.ticketList}>
            {otherActiveTickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onShowQR={() => setQrTicket(ticket)}
                onCheckedIn={handleCheckedIn}
                onFormComplete={handleFormCompleted}
                canEarnPoints={canEarnPoints}
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
                    {new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short' })}
                  </span>
                  <span className={styles.eventDay}>
                    {/* Date.getDate() reads the day-of-month in the runtime's
                        local timezone — for a viewer far from Pacific time,
                        near a midnight boundary this can be a different day
                        than what the month label above (correctly Pacific)
                        shows. Format it instead of reading it raw. */}
                    {new Date(event.start_date).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, day: 'numeric' })}
                  </span>
                </div>
                <div className={styles.eventBody}>
                  <div className={styles.eventTitle}>{event.title}</div>
                  {event.location && (
                    <div className={styles.eventLoc}><MapPin size={12} strokeWidth={1.5} aria-hidden="true" /> {event.location}</div>
                  )}
                  {canEarnPoints && !!event.points_value && (
                    <div className={styles.eventPointsBadge}><Award size={11} strokeWidth={1.75} aria-hidden="true" /> +{event.points_value} pts on check-in</div>
                  )}
                </div>
                {event.audience === 'ucsd_only' && !isUcsd ? (
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
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tickets.length === 0 && unregisteredEvents.length === 0 && (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><Ticket size={40} strokeWidth={1.25} aria-hidden="true" /></span>
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
              <TicketRow key={ticket.id} ticket={ticket} onFormComplete={handleFormCompleted} canEarnPoints={canEarnPoints} />
            ))}
          </div>
        </section>
      )}

      {/* Fullscreen QR overlay */}
      {qrTicket && (
        <FullscreenQR
          ticketId={qrTicket.id}
          eventTitle={qrTicket.event?.title ?? 'Event'}
          eventDate={qrTicket.event?.start_date}
          eventLocation={qrTicket.event?.location}
          onClose={() => setQrTicket(null)}
          onCheckedIn={(checkedInAt) => handleCheckedIn(qrTicket.id, checkedInAt)}
          checkinFormUrl={qrTicket.checkinFormUrl}
          onFormComplete={handleFormCompleted}
        />
      )}
    </div>
  );
}

function TicketRow({
  ticket,
  onShowQR,
  onCheckedIn,
  onFormComplete,
  canEarnPoints,
}: {
  ticket: TicketData;
  onShowQR?: () => void;
  onCheckedIn?: (ticketId: string, checkedInAt: string) => void;
  onFormComplete?: (ticketId: string) => void;
  canEarnPoints: boolean;
}) {
  const ev = ticket.event;
  // A ticket's DB status never actually flips to 'expired' on its own (see
  // isCheckinWindowOpen/performCheckin) — it just stays 'active' forever,
  // which read as "still valid" here even for an event from months ago.
  // Derive the display status instead of trusting the raw one: still
  // 'active' looks and behaves like 'active' right up until the event's
  // checkin window actually closes.
  const isExpired = ticket.status === 'active' && !!ev && !isCheckinWindowOpen(ev);
  const displayStatus = isExpired ? 'expired' : ticket.status;
  const isActionable = ticket.status === 'active' && !isExpired;
  // Same cutoff as isExpired above, just not tied to status === 'active' —
  // this gates the "Complete AS Form" fallback on an *already checked-in*
  // ticket, which is always 'used' by definition. UCSD's form has its own
  // "I certify I am currently physically present" line, so this shouldn't
  // stay clickable once the event is actually over — someone submitting it
  // days later would be certifying something no longer true.
  const eventHasEnded = !!ev && !isCheckinWindowOpen(ev);
  const [showFormModal, setShowFormModal] = useState(false);
  // Local override so the UI updates the instant they confirm, without
  // waiting on a full data refetch — initialized from the server value,
  // then set directly once CheckinFormModal's onComplete fires. Also kept
  // in sync with the prop via the effect below: a completion confirmed
  // elsewhere (FullscreenQR's own "I've Completed This Form", reached via
  // the QR check-in screen rather than this row) updates the shared
  // tickets list in TicketsClient, but a useState initializer only runs
  // once on mount — without this sync, this row would never pick up a
  // change that happened somewhere else and keep wrongly offering the form.
  const [formCompletedAt, setFormCompletedAt] = useState(ticket.checkin_form_completed_at ?? null);
  useEffect(() => {
    setFormCompletedAt(ticket.checkin_form_completed_at ?? null);
  }, [ticket.checkin_form_completed_at]);
  return (
    <div className={`${styles.ticketRow} ${!isActionable ? styles.ticketDim : ''}`}>
      <div className={styles.ticketLeft}>
        <span className={styles.ticketStatusIcon}>{STATUS_ICON[displayStatus]}</span>
      </div>
      <div className={styles.ticketInfo}>
        <div className={styles.ticketEventName}>{ev?.title ?? 'Unknown Event'}</div>
        {ev?.start_date && (
          <div className={styles.ticketDate}>
            {new Date(ev.start_date).toLocaleDateString('en-US', {
              timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric',
            })}
          </div>
        )}
        {ticket.checked_in_at && (
          <div className={styles.checkedInLine}>
            <Check size={13} strokeWidth={1.75} aria-hidden="true" /> Checked in {new Date(ticket.checked_in_at).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })}
          </div>
        )}
        {/* Fallback for the "accidentally dismissed it" / "staff checked me
            in manually without my phone" cases — not gated on isActionable
            (a checked-in ticket is never actionable), just on actually
            being checked in and the event actually having a form. Stays
            available for as long as the event's still considered ongoing,
            then disappears — see eventHasEnded. Once they've confirmed
            completion, this stops re-offering the form entirely — our UI
            shouldn't invite a second submission, even though we can't stop
            someone from revisiting the raw form URL on their own. */}
        {ticket.checked_in_at && ticket.checkinFormUrl && !eventHasEnded && (
          formCompletedAt ? (
            <div className={styles.checkedInLine}>
              <Check size={13} strokeWidth={1.75} aria-hidden="true" /> AS Form completed
            </div>
          ) : (
            <button type="button" className={styles.completeFormBtn} onClick={() => setShowFormModal(true)}>
              <ClipboardList size={13} strokeWidth={1.75} aria-hidden="true" /> Complete AS Form
            </button>
          )
        )}
        {canEarnPoints && isActionable && !!ev?.points_value && (
          <div className={styles.ticketPointsBadge}><Award size={11} strokeWidth={1.75} aria-hidden="true" /> +{ev.points_value} pts on check-in</div>
        )}
        {showFormModal && ticket.checkinFormUrl && !eventHasEnded && (
          <CheckinFormModal
            ticketId={ticket.id}
            url={ticket.checkinFormUrl}
            onClose={() => setShowFormModal(false)}
            onComplete={() => { setFormCompletedAt(new Date().toISOString()); onFormComplete?.(ticket.id); }}
          />
        )}
      </div>
      <div className={styles.ticketRight}>
        <div className={styles.ticketRightRow}>
          {isActionable && ev?.id && <AddToCalendarButton eventId={ev.id} iconOnly />}
          {isActionable && ev?.is_online && onCheckedIn ? (
            <OnlineCheckinEntry ticketId={ticket.id} eventId={ev.id} onCheckedIn={onCheckedIn} checkinFormUrl={ticket.checkinFormUrl} onFormComplete={onFormComplete} compact />
          ) : isActionable && onShowQR ? (
            <button className={styles.qrMiniBtn} onClick={onShowQR}>
              <span aria-hidden="true">▦</span> View QR
            </button>
          ) : (
            <span className={`${styles.statusBadge} ${styles[`status_${displayStatus}`]}`}>
              {STATUS_LABEL[displayStatus]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
