'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Ticket, X, Check, Zap, ClipboardList } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import TicketQRBadge from '@/components/TicketQRBadge/TicketQRBadge';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { DEFAULT_QR_OPTIONS, type QRCodeOptions } from '@/lib/qrCodeStyling';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/timezone';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import AsFormButton from './AsFormButton';
import { saveTicketCodes, currentCachedCode, cachedMinutesLeft, clearTicketCodes } from '@/lib/ticketCodeCache';
import styles from './fullscreenqr.module.css';

// Same TG-branded look as the portal's QR Studio "default" preset (see
// src/lib/qrCodeStyling.ts) — TG logo stays centered in the QR itself; the
// event name used to sit there instead (see git history / eventLabelIcon),
// but now arcs around the outside as part of the circular badge (see
// TicketQRBadge + qrBadge.ts) so it doesn't compete with the logo.
//
// margin is deliberately the normal/small value, NOT inflated to make room
// for a tight circular crop — an earlier attempt at that (large margin +
// crop into it) turned out to break decoding in this library at high margin
// values, confirmed by actually decoding the result with jsQR (the same
// decoder the check-in scanner uses), not just by the geometry. The badge's
// circle instead circumscribes the whole (fully intact) QR square — see
// qrBadge.ts.
const TICKET_QR_BASE: Omit<QRCodeOptions, 'data' | 'icon' | 'customIcon'> = {
  ...DEFAULT_QR_OPTIONS,
  size: 260,
  iconPadding: 6,
  // Plain circular modules (not the Studio default's "extra-rounded" blobs)
  // so the real QR's own dots match the decorative ring's dots exactly —
  // same shape, same size logic — instead of two subtly different rounded
  // styles sitting next to each other.
  dotsType: 'dots',
  // The finder-pattern frame ("corner") is otherwise the one hard-edged,
  // squared-off shape left in an all-circular badge — a rounded square still
  // reads as "a square sitting inside a circle." Rendering it as a ring/dot
  // shape instead keeps every element of the badge, real and decorative,
  // built from the same circular vocabulary.
  cornersSquareType: 'dot',
};

interface Props {
  ticketId: string;
  eventTitle: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  onClose: () => void;
  onCheckedIn?: (checkedInAt: string) => void;
  // Pre-built server-side (see getTicketsData) for events with "Requires
  // UCSD check-in form" turned on — null/undefined for every other event.
  checkinFormUrl?: string | null;
  // Lets the ticket list know completion happened here, so its own
  // "Complete AS Form" fallback (TicketRow) doesn't keep re-offering a
  // form this same screen already confirmed as done — without this, that
  // fallback's local state has no way to learn about a completion that
  // happened somewhere else.
  onFormComplete?: (ticketId: string) => void;
}

export default function FullscreenQR({ ticketId, eventTitle, eventDate, eventLocation, onClose, onCheckedIn, checkinFormUrl, onFormComplete }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(30);
  const [rotationSeconds, setRotationSeconds] = useState(30);
  const [error, setError] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  // Whether this member currently holds a fulfilled Fast Pass reward (from
  // either shop — see grants_fast_pass in api/tickets/[id]/qr) — a
  // standing perk, not something specific to this one ticket, so it's just
  // surfaced here rather than re-fetched every rotation.
  const [hasFastPass, setHasFastPass] = useState(false);
  // TicketQRBadge's own canvas-render poll timed out — the code/data loaded
  // fine, but drawing the QR itself (a device/browser-side thing, not a
  // network one) never produced a paintable canvas. Reset on every new
  // qrData so a fresh code gets its own full chance to render rather than
  // staying permanently flagged failed from one bad attempt.
  const [qrRenderFailed, setQrRenderFailed] = useState(false);
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the code across renders without needing it in fetchCode's own
  // dependency list (that would redefine fetchCode every refresh and
  // re-trigger the mount effect that calls it — a fetch loop). Only reason
  // this exists: telling "the window actually rolled over" apart from "we
  // re-checked but nothing's new yet."
  const lastCodeRef = useRef<string | null>(null);

  const fetchCode = useCallback(async () => {
    // Once checked in there's nothing left to show a code for, and the /qr
    // endpoint would just reject with "not active" anyway.
    if (checkedIn) return;

    // Always cancel any pending scheduled refresh before fetching — otherwise
    // a visibility/focus-triggered call (below) races the normal timer chain
    // and both keep independently rescheduling themselves forever.
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
      refreshTimeout.current = null;
    }
    try {
      // Top up the offline cache whenever it's running low (see
      // lib/ticketCodeCache) — the batch rides along on the normal fetch.
      const wantAhead = cachedMinutesLeft(ticketId) < 45;
      const res = await fetchWithRetry(`/api/tickets/${ticketId}/qr${wantAhead ? '?ahead=1' : ''}`);
      const data = await res.json();
      if (res.ok) saveTicketCodes(ticketId, data);
      if (!res.ok) {
        // The /qr endpoint rejects once the ticket's no longer 'active' —
        // exactly what happens the instant staff check someone in. Realtime
        // and the polling backstop below are the normal, fast path for
        // catching that, but this fetch (the scheduled refresh, or a
        // visibility/focus regain after the phone was locked/backgrounded
        // through the actual scan) can land *after* the check-in but
        // *before* either of those notices it. Rather than just showing a
        // dead-end error in that case, confirm the real status directly —
        // if it's actually checked in, transition immediately instead of
        // leaving the attendee stuck looking at "failed to load code" (and,
        // with a check-in form configured, missing the auto-popup entirely).
        try {
          const statusRes = await fetch(`/api/tickets/${ticketId}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            // checked_in_today is false for a multi-day ticket scanned on an earlier day
            if (statusData.status === 'used' && statusData.checked_in_today !== false) {
              handleCheckedIn(statusData.checked_in_at ?? new Date().toISOString());
              return;
            }
          }
        } catch {
          // fall through to the plain error below
        }
        // Rejected (cancelled/expired ticket, etc.) — never keep showing a
        // pre-fetched code for a ticket the server says is no longer valid.
        clearTicketCodes(ticketId);
        setQrData(null);
        setCode(null);
        lastCodeRef.current = null;
        setError(data.error || 'Failed to load code');
        return;
      }
      setError('');
      setQrData(data.qr_data);
      setQrRenderFailed(false); // new qrData remounts TicketQRBadge — give it a fresh attempt
      setHasFastPass(Boolean(data.has_fast_pass));
      // The visibility/focus listener below re-runs this on every tab
      // refocus, even mid-window when the code hasn't actually changed —
      // reassigning expiresIn/rotationSeconds in that case fed a *new*
      // animation-delay to the ring's still-running, non-remounted CSS
      // animation (same code -> same key -> no remount), which browsers
      // handle by re-seeking its current position — the "sudden jump."
      // Only touch the ring's timing when the code genuinely rotated.
      if (data.code !== lastCodeRef.current) {
        lastCodeRef.current = data.code;
        setCode(data.code);
        setExpiresIn(data.expires_in);
        setRotationSeconds(data.rotation_seconds || 30);
      }
      // Refresh shortly *after* it actually expires (not a couple seconds
      // before) — currentWindow() on the server hasn't rolled over yet at
      // "2s early," so that old timing just re-fetched the *same* code and
      // relied on a second, tighter follow-up poll to finally land past the
      // boundary, adding up to another full second of visible delay between
      // the ring finishing and the next code actually showing. Landing
      // just after the boundary the first time means one round trip, not
      // two, for the swap.
      const delayMs = data.expires_in * 1000 + 350;
      refreshTimeout.current = setTimeout(fetchCode, delayMs);
    } catch {
      // A genuine network failure (as opposed to the server responding with
      // a real rejection like "not active", handled above) is exactly the
      // "spotty connection" case — nothing about it is permanent, so retry
      // on its own instead of leaving this screen stuck on an error forever
      // until someone thinks to close and reopen it.
      // If we hold a pre-fetched code for right now (see ticketCodeCache),
      // keep showing a valid QR instead of an error — the scanner accepts it
      // exactly as if it had just been fetched.
      const cached = currentCachedCode(ticketId);
      if (cached) {
        setError('');
        setQrData(cached.qr_data);
        setQrRenderFailed(false);
        setHasFastPass(cached.has_fast_pass);
        if (cached.code !== lastCodeRef.current) {
          lastCodeRef.current = cached.code;
          setCode(cached.code);
          setExpiresIn(cached.expires_in);
          setRotationSeconds(30);
        }
        refreshTimeout.current = setTimeout(fetchCode, cached.expires_in * 1000 + 350);
      } else {
        setError('Network error — retrying…');
        refreshTimeout.current = setTimeout(fetchCode, 4000);
      }
    }
  }, [ticketId, checkedIn]);

  useEffect(() => {
    // Show the pre-fetched code for this window immediately (no spinner, no
    // waiting on signal), then let the normal fetch confirm/refresh it.
    const cached = currentCachedCode(ticketId);
    if (cached && lastCodeRef.current === null) {
      lastCodeRef.current = cached.code;
      setQrData(cached.qr_data);
      setCode(cached.code);
      setExpiresIn(cached.expires_in);
      setRotationSeconds(30);
      setHasFastPass(cached.has_fast_pass);
    }
    fetchCode();
    return () => { if (refreshTimeout.current) clearTimeout(refreshTimeout.current); };
  }, [fetchCode, ticketId]);

  // Keep the phone from dimming/locking while the QR is on screen — someone
  // waiting in line shouldn't have to unlock again to get scanned. Silently
  // does nothing where the Wake Lock API isn't supported.
  useEffect(() => {
    if (checkedIn) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    async function acquire() {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) { l.release().catch(() => {}); return; }
        lock = l;
      } catch {
        // denied (e.g. low battery mode) — not critical
      }
    }
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [checkedIn]);

  // Mobile browsers throttle or fully pause setTimeout while a tab is
  // backgrounded (screen lock, switching apps) — exactly what happens while
  // someone waits in line. The scheduled refresh above may never have fired,
  // leaving a stale, now-rejected code on screen. Force a fresh one the
  // instant the page is visible again instead of waiting on that timer.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchCode();
    }
    // Regaining connectivity mid-window shouldn't wait for the next
    // scheduled poll — the code may already be stale by then, especially
    // right after a longer drop.
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', fetchCode);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', fetchCode);
    };
  }, [fetchCode]);

  // Fires exactly once — from whichever of Realtime (fast path) or the
  // polling backstop below (guaranteed path) notices the check-in first.
  const handledCheckIn = useRef(false);
  function handleCheckedIn(checkedInAt: string) {
    if (handledCheckIn.current) return;
    handledCheckIn.current = true;
    clearTicketCodes(ticketId);
    setCheckedInAt(checkedInAt);
    setCheckedIn(true);
    // A short buzz so someone about to pocket their phone notices the screen
    // changed (Android/most Chromium browsers; iOS ignores it).
    try { navigator.vibrate?.([220, 90, 220]); } catch { /* unsupported */ }
    onCheckedInRef.current?.(checkedInAt);
  }

  // Live push from the checkin scanner's DB write (see the
  // enable_tickets_realtime migration) — lets this screen show "Checked In"
  // the instant staff scan it. Stored in a ref so the subscription doesn't
  // need to be torn down and rebuilt whenever the parent passes a new
  // onCheckedIn closure.
  const onCheckedInRef = useRef(onCheckedIn);
  useEffect(() => { onCheckedInRef.current = onCheckedIn; }, [onCheckedIn]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ticket-checkin-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; checked_in_at?: string | null };
          if (newRow.status === 'used') handleCheckedIn(newRow.checked_in_at ?? new Date().toISOString());
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // Backstop for the Realtime subscription above — a websocket can fail to
  // connect for reasons that have nothing to do with this app (a campus
  // wifi proxy blocking upgrades, a misconfigured project, etc.), and
  // "check-in doesn't show up" is bad enough that this shouldn't depend on
  // Realtime alone. Polls a tiny status endpoint every few seconds; stops
  // once checked in.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (handledCheckIn.current) return;
      try {
        const res = await fetch(`/api/tickets/${ticketId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'used' && data.checked_in_today !== false) handleCheckedIn(data.checked_in_at ?? new Date().toISOString());
      } catch {
        // ignore — next tick tries again
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  // The authoritative form answer, fetched from the status endpoint the
  // moment check-in lands — the checkinFormUrl prop was baked in when the
  // tickets page loaded, which can be stale (screen left open a long time,
  // form settings changed since). null until resolved.
  const [resolvedFormUrl, setResolvedFormUrl] = useState<string | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [tierInfo, setTierInfo] = useState<{
    lifetime_points: number;
    tier: { name: string; color: string };
    tier_up: { from: string; to: string; color: string } | null;
    next_tier: { name: string; color: string; points_needed: number; progress: number } | null;
  } | null>(null);
  const [formOpened, setFormOpened] = useState(false);
  useEffect(() => {
    if (!checkedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setResolvedFormUrl(data.checkin_form_url ?? null);
            setPointsAwarded(data.points_awarded ?? 0);
            setTierInfo(data.tier_info ?? null);
            if (data.checkin_form_completed_at) setFormOpened(true);
          }
        }
      } catch {
        // fall back to the page-load prop below
      }
    })();
    return () => { cancelled = true; };
  }, [checkedIn, ticketId]);
  const formUrl = resolvedFormUrl ?? checkinFormUrl ?? null;
  // Opening the form is the attendee's whole step (see AsFormButton) —
  // record it locally and tell the ticket list so its own AS Form button
  // reflects it too.
  // Scanned in, but the AS Form is still outstanding. The screen looks
  // *unfinished* (amber, "Step 1 of 2") until they open the form — people
  // were taking the green "You're checked in" as "all done" and pocketing the
  // phone before ever reaching the form. Staff can tell at a glance too:
  // amber = form not opened yet, green = done.
  const formRequired = !!formUrl || !!checkinFormUrl;
  const stepPending = checkedIn && formRequired && !formOpened;

  function handleFormOpened(id: string) {
    setFormOpened(true);
    onFormComplete?.(id);
  }

  // The "You're Checked In!" screen deliberately stays up until the person
  // closes it themselves (X, or tapping outside) — it used to auto-close
  // after 2.5s, which meant staff or the attendee couldn't glance at it to
  // confirm the check-in went through. The ticket list behind it already
  // shows the ticket as checked in (see onCheckedIn above).

  // Close on backdrop tap
  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const dateLabel = eventDate
    ? formatPacificDateTime(eventDate, { weekday: true })
    : null;

  // qr_data is `${eventSlug}:${rotatingCode}` (see /api/tickets/[id]/qr) —
  // reuse that same slug for the arced label so it can never drift out of
  // sync with what the code actually encodes. Falls back to the title for
  // events with no slug set.
  const eventLabel = (qrData?.includes(':') ? qrData.split(':')[0] : '') || eventTitle;

  // Portaled straight to <body> instead of rendering in place — this opens
  // from inside PortalHub's section panel, which Framer Motion animates
  // with an inline `transform` (see PortalHub.tsx). A `transform` on an
  // ancestor makes it the containing block for any `position: fixed`
  // descendant (this modal's .backdrop) instead of the viewport, and also
  // starts a new stacking context — so despite its own z-index:1000, the
  // whole modal was rendering *inside* that ancestor's stacking context,
  // unable to appear above a sibling like the bottom tab bar. A portal
  // sidesteps both problems by not being a descendant of that transformed
  // panel in the DOM at all.
  return createPortal(
    <div className={styles.backdrop} onClick={onBackdrop}>
      <div className={styles.sheet}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={18} strokeWidth={1.75} /></button>

        {/* Which event this ticket is for — shown first and prominently so it
            can't be confused with a different event's ticket. */}
        <div className={styles.eventBlock}>
          <span className={styles.eventEyebrow}><Ticket size={13} strokeWidth={1.5} aria-hidden="true" /> TICKET FOR</span>
          <div className={styles.eventName}>{eventTitle}</div>
          {(dateLabel || eventLocation) && (
            <div className={styles.eventMeta}>
              {dateLabel}
              {dateLabel && eventLocation && ' · '}
              {eventLocation}
            </div>
          )}
          {hasFastPass && !checkedIn && (
            <span className={styles.fastPassBadge}><Zap size={13} strokeWidth={2} aria-hidden="true" /> Fast Pass — skip the line</span>
          )}
        </div>

        {checkedIn ? (
            <div className={styles.checkedInState}>
              {stepPending ? (
                <>
                  <div className={`${styles.checkedInIcon} ${styles.stepIcon}`} aria-hidden="true"><ClipboardList size={32} strokeWidth={2} /></div>
                  <div className={styles.stepKicker}>Step 1 of 2 · Scanned</div>
                  <div className={styles.stepTitle}>One more step —<br />fill out your AS Form</div>
                  <p className={styles.stepSub}>You&apos;re not fully checked in until the AS Form is done.</p>
                  {/* The action goes right under the headline, above the time
                      and points — on a short phone screen it must be in view. */}
                  {formUrl && <AsFormButton ticketId={ticketId} url={formUrl} opened={formOpened} onOpened={handleFormOpened} />}
                </>
              ) : (
                <>
                  <div className={styles.checkedInIcon} aria-hidden="true"><Check size={32} strokeWidth={2} /></div>
                  <div className={styles.checkedInTitle}>You&apos;re Checked In!</div>
                </>
              )}
              {checkedInAt && (
                <div className={styles.checkedInTime}>
                  {new Date(checkedInAt).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </div>
              )}
              {pointsAwarded > 0 && (
                <div className={styles.pointsEarned}>
                  <span className={styles.pointsEarnedNumber}>+{pointsAwarded}</span>
                  <span className={styles.pointsEarnedLabel}>points earned</span>
                  {tierInfo?.tier_up && (
                    <div className={styles.tierUp} style={{ '--tier-color': tierInfo.tier_up.color } as React.CSSProperties}>
                      <div className={styles.confetti} aria-hidden="true">
                        {Array.from({ length: 18 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}
                      </div>
                      <div className={styles.tierUpKicker}>Tier up!</div>
                      <div className={styles.tierUpName}>{tierInfo.tier_up.to}</div>
                      <div className={styles.tierUpFrom}>you were {tierInfo.tier_up.from}</div>
                    </div>
                  )}
                  {tierInfo && (
                    <div className={styles.tierProgress}>
                      <div className={styles.tierProgressTop}>
                        <span style={{ color: tierInfo.tier.color }} className={styles.tierProgressName}>{tierInfo.tier.name}</span>
                        <span className={styles.tierProgressTotal}>{tierInfo.lifetime_points.toLocaleString()} pts</span>
                      </div>
                      {tierInfo.next_tier ? (
                        <>
                          <div className={styles.tierBar} aria-hidden="true">
                            <div className={styles.tierBarFill} style={{ width: `${Math.round(tierInfo.next_tier.progress * 100)}%`, background: tierInfo.next_tier.color }} />
                          </div>
                          <div className={styles.tierNext}>
                            <strong>{tierInfo.next_tier.points_needed.toLocaleString()} pts</strong> to reach <span style={{ color: tierInfo.next_tier.color }}>{tierInfo.next_tier.name}</span>
                          </div>
                        </>
                      ) : (
                        <div className={styles.tierNext}>Top tier reached 🎉</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {formUrl && !stepPending && (
                <AsFormButton ticketId={ticketId} url={formUrl} opened={formOpened} onOpened={handleFormOpened} />
              )}
              {!formUrl && !stepPending && <p className={styles.hint}>Have a great time — see you inside.</p>}
            </div>
        ) : (
          <>
            <div className={styles.label}>
              SHOW THIS AT CHECK-IN
              <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
            </div>

            <div className={styles.qrWrapper}>
              {code && (
                // Circumscribes the badge's own circle rather than sitting as
                // a separate bar underneath — the ring itself *is* the "time
                // left" readout, draining smoothly around the thing it's
                // timing instead of a detached indicator elsewhere on screen.
                <svg className={styles.countdownRing} viewBox="0 0 100 100" aria-hidden="true">
                  <circle className={styles.countdownTrack} cx="50" cy="50" r="48" />
                  <circle
                    key={code}
                    className={styles.countdownFill}
                    cx="50" cy="50" r="48"
                    // Always paced to a full rotation cycle (animation-duration),
                    // then seeked forward with a *negative* delay to however much
                    // of that cycle has already elapsed — the standard CSS trick
                    // for resuming an animation partway through instead of
                    // replaying it from the start. Opening the ticket mid-window
                    // (expiresIn < rotationSeconds, e.g. 4s left of a 30s cycle)
                    // now shows the ring already mostly drained/red, exactly
                    // matching reality, instead of restarting from full green and
                    // rushing through the *entire* gold-to-red journey in just
                    // those 4 seconds — which is what "accelerates and suddenly
                    // ends" actually was: not a bug in the timer itself, but the
                    // ring always replaying its whole visual arc regardless of
                    // how much of the real cycle was left to show it in.
                    style={{
                      animationDuration: `${rotationSeconds}s`,
                      animationDelay: `-${Math.max(0, rotationSeconds - expiresIn)}s`,
                    }}
                  />
                </svg>
              )}
              {qrData && qrRenderFailed ? (
                // The code/data itself loaded fine — this is specifically
                // "the canvas never finished painting on this device," not
                // a network problem, so the code fallback below is the
                // actual way through, not just a backup for while this loads.
                <div className={`${styles.qrCanvas} ${styles.qrLoading}`}>
                  <span className={styles.qrFailedText}>QR unavailable on this device — use the code below</span>
                </div>
              ) : qrData ? (
                // Keyed by qrData (not a stable key) specifically so React
                // remounts this on every refresh — that's what restarts the
                // fade-in below each time, turning what used to be an
                // instant, jarring swap into a brief soft crossfade instead.
                <div key={qrData} className={styles.qrSwap}>
                  <TicketQRBadge
                    options={{ ...TICKET_QR_BASE, data: qrData, icon: 'tg-color', customIcon: null }}
                    eventLabel={eventLabel}
                    className={styles.qrCanvas}
                    onFail={() => setQrRenderFailed(true)}
                  />
                </div>
              ) : (
                // On a slow connection this can sit for a couple seconds
                // waiting on the /qr fetch — a blank white circle here reads
                // as broken far more easily than a plain loading spinner
                // does, especially for the one screen someone opens
                // specifically to look at right now.
                <div className={`${styles.qrCanvas} ${styles.qrLoading}`}>
                  <LoadingSpinner size={32} label="Loading your code…" theme="light" />
                </div>
              )}
            </div>

            {/* Always rendered, even before the first code arrives — this
                used to only mount once `code` was set, which meant the
                sheet's total height (it's bottom-anchored — see .sheet's
                align-items:flex-end on .backdrop) grew the instant the code
                first loaded, shoving everything above it, including the QR
                itself, upward. Reserving the space with a placeholder from
                the start keeps the sheet's height — and the QR's position —
                constant through that transition. */}
            <div className={styles.fallbackCard}>
              <div className={styles.fallbackHint}>Scanner not working? Staff can type this code:</div>
              {code ? (
                <div key={code} className={`${styles.fallbackCode} ${styles.qrSwap}`}>
                  <span className={styles.fallbackHash}>#</span>
                  <span className={styles.fallbackValue}>{code}</span>
                </div>
              ) : (
                <div className={styles.fallbackCode} aria-hidden="true">
                  <span className={styles.fallbackHash}>#</span>
                  <span className={`${styles.fallbackValue} ${styles.fallbackValuePlaceholder}`}>······</span>
                </div>
              )}
            </div>
            {error && <div className={styles.codeText}>{error}</div>}

            <p className={styles.hint}>
              This code refreshes automatically, so a screenshot from earlier
              won&apos;t scan. Just keep this screen open when it&apos;s your turn —
              check-in reads whatever code is showing at that moment.
            </p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
