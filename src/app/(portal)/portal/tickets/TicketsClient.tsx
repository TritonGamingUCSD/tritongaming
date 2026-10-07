'use client';

import Notice from '@/components/ui/Notice';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { usePortalParams } from '@/lib/portal/usePortalParams';
import WeekHead from '@/components/ui/WeekHead';
import { pacificKey, startsWeekGroup } from '@/lib/events/weekGroups';
import Link from '@/components/portal/NoPrefetchLink';
import { getAttributionSource } from '@/lib/site/attribution';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Ticket, MapPin, QrCode, Check, X, Timer, Award } from 'lucide-react';
import FullscreenQR from './FullscreenQR';
import OnlineCheckinEntry from './OnlineCheckinEntry';
import AsFormButton from './AsFormButton';
import AddToCalendarButton from '@/components/AddToCalendarButton/AddToCalendarButton';
import { PACIFIC_TZ, pacificDaysUntil, formatEventDateRange, eventDayCount, eventDayProgress } from '@/lib/core/timezone';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import { saveTicketCodes, cachedMinutesLeft } from '@/lib/events/ticketCodeCache';
import styles from './tickets.module.css';
import SectionHeader from '@/components/ui/SectionHeader';

interface TicketData {
  id: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  checked_in_at: string | null;
  created_at: string;
  // Multi-day events: already scanned in today (one check-in per day).
  checkedInToday?: boolean;
  event: {
    id: string;
    title: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    flyer_url: string | null;
    points_value?: number;
    is_online: boolean;
    // Multi-day events can set check-in hours per day (Pacific time); a day without an entry is open all day.
    checkin_windows?: { day: string; start: string; end: string }[] | null;
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState(initialTickets);

  // Closing the QR screen after a successful check-in: reload the server
  // data (so the ticket's status, points and AS Form state are the real,
  // saved ones, not just what this screen last saw) and land on the tickets
  // view scrolled to the top, where the ticket now shows as Checked In.
  function closeQr() {
    const wasCheckedIn = qrTicket ? tickets.find((t) => t.id === qrTicket.id)?.status === 'used' : false;
    setQrTicket(null);
    setPortalParams({ qr: null });
    if (!wasCheckedIn) return;
    if (!pathname.startsWith('/portal/tickets')) router.push('/portal/tickets');
    router.refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Quietly preload the next stretch of QR codes for any in-person ticket
  // whose event is starting soon or underway (see lib/ticketCodeCache) — so
  // the ticket opens instantly and still shows a valid code if signal drops
  // at the venue. Runs on load and again whenever the phone regains signal
  // or the tab comes back to the foreground.
  useEffect(() => {
    function preload() {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      const nowMs = Date.now();
      tickets.forEach((t) => {
        if (!needsScanToday(t) || !t.event || t.event.is_online) return;
        const start = new Date(t.event.start_date).getTime();
        const end = t.event.end_date ? new Date(t.event.end_date).getTime() : start + 24 * 60 * 60 * 1000;
        if (start - nowMs > 3 * 60 * 60 * 1000 || end < nowMs) return;
        if (cachedMinutesLeft(t.id) >= 45) return;
        fetch(`/api/tickets/${t.id}/qr?ahead=1`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => { if (data) saveTicketCodes(t.id, data); })
          .catch(() => {});
      });
    }
    preload();
    document.addEventListener('visibilitychange', preload);
    window.addEventListener('online', preload);
    return () => {
      document.removeEventListener('visibilitychange', preload);
      window.removeEventListener('online', preload);
    };
  }, [tickets]);
  // /portal/tickets?qr=<ticket id> (the dashboard's "Show my QR") opens that ticket's code straight away.
  const setPortalParams = usePortalParams();
  const [qrTicket, setQrTicket] = useState<TicketData | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('qr');
    const t = id ? tickets.find((x) => x.id === id && x.status === 'active') : null;
    if (t) setQrTicket(t);
    // only on arrival: later changes to the ticket list must not reopen a code that was closed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Claimed ahead of the event: confirm it instead of opening the QR code (which only matters on the day).
  const [claimed, setClaimed] = useState<{ title: string; when: string } | null>(null);
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
        body: JSON.stringify({ event_id: eventId, source: getAttributionSource() }),
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
        // On the event day (or while it runs) they will want the code right now. Before that, just confirm they have the ticket.
        if (event && pacificDaysUntil(event.start_date) > 0) {
          setClaimed({ title: event.title, when: formatEventDateRange(event.start_date, null, { weekday: true }) });
        } else {
          setQrTicket(newTicket);
        }
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
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: 'used', checked_in_at: checkedInAt, checkedInToday: true } : t)));
  }

  // Same idea as handleCheckedIn above — reflects a completion confirmed
  // from FullscreenQR's own "I've Completed This Form" button into the
  // shared tickets list, so TicketRow's fallback (which reads this same
  // field) doesn't keep offering a form that was already confirmed done
  // somewhere else.
  function handleFormCompleted(ticketId: string) {
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, checkin_form_completed_at: new Date().toISOString() } : t)));
  }

  // A ticket's DB status stays 'active' forever (nothing flips it when the
  // event ends — see isCheckinWindowOpen), so "active" here means active
  // *and* the event's check-in window is still open. One whose event has
  // ended belongs with the past tickets (shown there as Expired), not in
  // the Active list.
  const isLive = (t: TicketData) => (t.status === 'active' || (t.status === 'used' && isMultiDay(t))) && !!t.event && isCheckinWindowOpen(t.event);
  const activeTickets = tickets.filter(isLive);
  const pastTickets   = tickets.filter((t) => !isLive(t));

  // Tickets come back sorted by when they were registered, not by event date —
  // pick whichever active ticket's event is soonest, not just the first one
  // in that list. "Still relevant" means the event hasn't *ended* (its
  // check-in window is still open), not that it hasn't *started*: filtering
  // on start_date >= now made the featured ticket vanish the moment the
  // event began — right when people most need it to scan in. An event
  // already underway sorts ahead of later ones.
  const nextActiveTicket = activeTickets
    .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())[0];

  // Don't repeat the ticket already featured in the hero card above.
  const otherActiveTickets = activeTickets.filter((t) => t.id !== nextActiveTicket?.id);

  // Events the user hasn't registered for yet
  const registeredEventIds = new Set(tickets.map((t) => t.event?.id).filter(Boolean));
  const unregisteredEvents = upcomingEvents.filter((e) => !registeredEventIds.has(e.id));

  return (
    <div className={styles.page}>
      <SectionHeader title="My Tickets" flush sub="Your event tickets and what you’ve been to." />

      {checkoutResult === 'success' && (
        <Notice tone="success">Payment received — your ticket will appear here in a few seconds.</Notice>
      )}
      {checkoutResult === 'cancelled' && (
        <Notice tone="warning">Checkout was cancelled — no charge was made.</Notice>
      )}
      {claimed && (
        <Notice tone="success">
          You&apos;re in! You got your ticket for <strong>{claimed.title}</strong> ({claimed.when}). Your QR code will be right here in My Tickets when the day comes.
          {' '}<button type="button" onClick={() => setClaimed(null)} style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>Dismiss</button>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

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
                    {formatEventDateRange(nextActiveTicket.event.start_date, nextActiveTicket.event.end_date, { weekday: true })}
                    {' · '}
                    {new Date(nextActiveTicket.event.start_date).toLocaleTimeString('en-US', {
                      timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
                {nextActiveTicket.event?.location && (
                  <p className={styles.heroLocation}><MapPin size={13} strokeWidth={1.5} aria-hidden="true" /> {nextActiveTicket.event.location}</p>
                )}
                {nextActiveTicket.event && isMultiDay(nextActiveTicket) && <CheckinHours windows={nextActiveTicket.event.checkin_windows} />}
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
            {unregisteredEvents.map((event, i) => (
              <Fragment key={event.id}>
              {startsWeekGroup(unregisteredEvents.map((x) => pacificKey(x.start_date)), i) && <WeekHead as="div" date={pacificKey(event.start_date)} />}
              <div className={styles.eventRow}>
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
              </Fragment>
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
          onClose={closeQr}
          onCheckedIn={(checkedInAt) => handleCheckedIn(qrTicket.id, checkedInAt)}
          checkinFormUrl={qrTicket.checkinFormUrl}
          onFormComplete={handleFormCompleted}
        />
      )}
    </div>
  );
}

// Multi-day events let a ticket be scanned once per day, so "used" doesn't mean "done" for them.
const hoursLabel = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`; };

// Each day's check-in hours for a multi-day event (only days the organizers set hours for); today's row is highlighted.
function CheckinHours({ windows }: { windows?: { day: string; start: string; end: string }[] | null }) {
  if (!windows?.length) return null;
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: PACIFIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return (
    <ul className={styles.hoursList} aria-label="Check-in hours">
      {windows.slice().sort((a, b) => a.day.localeCompare(b.day)).map((w) => (
        <li key={w.day} className={w.day === todayKey ? styles.hoursToday : ''}>
          <span>{new Date(`${w.day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span>{hoursLabel(w.start)} – {hoursLabel(w.end)}</span>
        </li>
      ))}
    </ul>
  );
}

function isMultiDay(t: { event: { start_date: string; end_date: string | null } | null }): boolean {
  return !!t.event && eventDayCount(t.event.start_date, t.event.end_date) > 1;
}
function needsScanToday(t: TicketData): boolean {
  return t.status === 'active' || (t.status === 'used' && isMultiDay(t) && !t.checkedInToday && !!t.event && isCheckinWindowOpen(t.event));
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
  const multiDay = isMultiDay(ticket);
  const dayProgress = multiDay && ev ? eventDayProgress(ev.start_date, ev.end_date) : null;
  // A multi-day ticket scanned on an earlier day can show its QR again today.
  const isActionable = needsScanToday(ticket) && !isExpired;
  // Same cutoff as isExpired above, just not tied to status === 'active' —
  // this gates the "Complete AS Form" fallback on an *already checked-in*
  // ticket, which is always 'used' by definition. UCSD's form has its own
  // "I certify I am currently physically present" line, so this shouldn't
  // stay clickable once the event is actually over — someone submitting it
  // days later would be certifying something no longer true.
  const eventHasEnded = !!ev && !isCheckinWindowOpen(ev);
  // Greyed out only once it's really over (event ended, or the ticket was
  // cancelled) — not merely because it's already been used. A checked-in
  // ticket for an event that's still going on should look current.
  const shouldDim = ticket.status === 'cancelled' || eventHasEnded;
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
    <div className={`${styles.ticketRow} ${shouldDim ? styles.ticketDim : ''}`}>
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
        {dayProgress && (
          <div className={styles.dayLine}>Day {dayProgress.day} of {dayProgress.total}{ticket.checkedInToday ? ' · checked in today' : ' · scan in today'}</div>
        )}
        {multiDay && <CheckinHours windows={ev?.checkin_windows} />}
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
          <AsFormButton
            ticketId={ticket.id}
            url={ticket.checkinFormUrl}
            opened={!!formCompletedAt}
            compact
            onOpened={() => { setFormCompletedAt(new Date().toISOString()); onFormComplete?.(ticket.id); }}
          />
        )}
        {canEarnPoints && isActionable && !!ev?.points_value && (
          <div className={styles.ticketPointsBadge}><Award size={11} strokeWidth={1.75} aria-hidden="true" /> +{ev.points_value} pts on check-in</div>
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
        {ticket.status === 'used' && eventHasEnded && ev?.id && (
          <Link href={`/portal/recap/${ev.id}`} className={styles.recapLink}>Photos &amp; feedback →</Link>
        )}
      </div>
    </div>
  );
}
