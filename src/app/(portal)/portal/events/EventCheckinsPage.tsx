'use client';

import Loading from '@/components/Loading/Loading';
import { Input, Select } from '@/components/ui/Field';
import { ArrowLeft, ArrowDown, ArrowUp } from 'lucide-react';
import { textCodec, useAddressState, wordCodec, type Codec } from '@/lib/portal/usePageState';
import Notice from '@/components/ui/Notice';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from '@/components/portal/NoPrefetchLink';
import UndoCheckinModal from '@/components/UndoCheckinModal/UndoCheckinModal';
import { Camera, Gamepad2, Undo2, Check } from 'lucide-react';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { PACIFIC_TZ, formatEventDateRange, eventDayCount } from '@/lib/core/timezone';
import checkinStyles from './checkins.module.css';
import styles from './eventcheckinspage.module.css';

interface TicketUser {
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  gamer_tag: string | null;
}

interface TicketRow {
  id: string;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  created_at: string;
  checked_in_at: string | null;
  days_attended?: number;
  checked_in_today?: boolean;
  // Honor-system only — the attendee's own "I've Completed This Form"
  // confirmation, not proof of an actual Google Forms submission (see
  // checkin_form_completed_at migration). This column exists so staff have
  // *some* visibility to physically double-check at the door, since the
  // app itself can't verify a real submission.
  checkin_form_completed_at: string | null;
  user: TicketUser | TicketUser[] | null;
}

interface EventInfo {
  id: string;
  end_date?: string | null;
  title: string;
  start_date: string;
  location: string | null;
  requires_checkin_form: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Registered', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired',
};

const STATUS_ORDER = ['active', 'used', 'cancelled', 'expired'];
type SortKey = 'registered' | 'name' | 'checkin' | 'status';
type GroupKey = 'none' | 'status' | 'form';
const sortWords = wordCodec<SortKey>(['registered', 'name', 'checkin', 'status'], 'registered');
const groupWords = wordCodec<GroupKey>(['none', 'status', 'form'], 'none');
const descCodec: Codec<boolean> = { parse: (r) => r === 'desc', format: (v) => (v ? 'desc' : null) };
const SORTS: { key: SortKey; label: string }[] = [{ key: 'registered', label: 'Registered' }, { key: 'name', label: 'Name' }, { key: 'checkin', label: 'Checked-in time' }, { key: 'status', label: 'Status' }];
const GROUP_STATUS: Record<string, string> = { active: 'Not Checked In Yet', used: 'Checked In', cancelled: 'Cancelled', expired: 'Expired' };
const userOf = (t: TicketRow) => (Array.isArray(t.user) ? t.user[0] : t.user);

// One event's tickets, as its own page in Events (/portal/events/check-ins/<event>): search, sort, group, and the manual check-in and undo for whoever can manage points.
// `eventKey` is the event's slug (or its id when it has none). Search, sort and group are in the address, so a copied link reopens the same view.
export default function EventCheckinsPage({ eventKey, onBack, canManagePoints }: { eventKey: string; onBack: () => void; canManagePoints: boolean }) {
    // The search, sort and group are in the address (lib/portal/usePageState), so a refresh or a shared link brings them back.
  const [query, setQuery] = useAddressState('q', textCodec);
  const [sort, setSort] = useAddressState('sort', sortWords);
  const [desc, setDesc] = useAddressState('dir', descCodec);
  const [group, setGroup] = useAddressState('view', groupWords);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState('');
  const [uncheckingId, setUncheckingId] = useState<string | null>(null);
  // Which ticket's undo-confirm (hold-to-confirm) modal is open.
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

  async function handleManualCheckIn(ticketId: string) {
    setCheckingInId(ticketId);
    setError('');
    try {
      const res = await fetch('/api/checkin/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to check in.'); return; }
      setTickets((prev) => prev?.map((t) => (t.id === ticketId ? { ...t, status: 'used', checked_in_at: t.checked_in_at ?? new Date().toISOString(), checked_in_today: true, days_attended: (t.days_attended ?? 0) + 1 } : t)) ?? null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCheckingInId(null);
    }
  }

  async function handleUncheckIn(ticketId: string) {
    setUncheckingId(ticketId);
    try {
      const res = await fetch('/api/checkin/reverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to undo check-in.'); return; }
      setTickets((prev) => prev?.map((t) => (t.id === ticketId ? { ...t, status: 'active', checked_in_at: null, checkin_form_completed_at: null } : t)) ?? null);
      setUndoTargetId(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUncheckingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventKey}/checkins`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || 'Failed to load check-ins.');
          return;
        }
        setEvent(json.event);
        setTickets(json.tickets);
      } catch {
        if (!cancelled) setError('Network error loading check-ins.');
      }
    })();
    return () => { cancelled = true; };
  }, [eventKey]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const name = (t: TicketRow) => (userOf(t)?.display_name ?? '').toLowerCase();
    const rows = (tickets ?? []).filter((t) => { const u = userOf(t); return !q || (u?.display_name ?? '').toLowerCase().includes(q) || (u?.gamer_tag ?? '').toLowerCase().includes(q); });
    const cmp = (a: TicketRow, b: TicketRow) => {
      if (sort === 'name') return name(a).localeCompare(name(b));
      if (sort === 'status') return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (sort === 'checkin') {   // people who have not checked in go last whichever way it runs
        if (!a.checked_in_at || !b.checked_in_at) return a.checked_in_at ? -1 : b.checked_in_at ? 1 : 0;
        return a.checked_in_at.localeCompare(b.checked_in_at) * (desc ? -1 : 1);
      }
      return a.created_at.localeCompare(b.created_at);
    };
    rows.sort((a, b) => (sort === 'checkin' ? cmp(a, b) : cmp(a, b) * (desc ? -1 : 1)) || name(a).localeCompare(name(b)));
    if (group === 'none') return [{ title: '', rows }];
    const label = (t: TicketRow) => (group === 'status' ? GROUP_STATUS[t.status] : t.status === 'cancelled' || t.status === 'expired' ? GROUP_STATUS[t.status] : t.status !== 'used' ? 'Not Checked In Yet' : t.checkin_form_completed_at ? 'Opened The Form' : 'Has Not Opened The Form');
    const order = group === 'status' ? ['Not Checked In Yet', 'Checked In', 'Cancelled', 'Expired'] : ['Has Not Opened The Form', 'Opened The Form', 'Not Checked In Yet', 'Cancelled', 'Expired'];
    const by = new Map<string, TicketRow[]>();
    for (const t of rows) by.set(label(t), [...(by.get(label(t)) ?? []), t]);
    return order.filter((o) => by.has(o)).map((title) => ({ title, rows: by.get(title)! }));
  }, [tickets, query, sort, desc, group]);

  const activeTickets = (tickets ?? []).filter((t) => t.status !== 'cancelled');
  const checkedInCount = (tickets ?? []).filter((t) => t.status === 'used').length;
  const attendanceRate = activeTickets.length > 0 ? Math.round((checkedInCount / activeTickets.length) * 100) : 0;

  // Base 4 columns (see checkins.module.css) plus whichever optional ones
  // actually apply — AS Form only for events that have it on, Actions only
  // for whoever can manage points/undo a check-in.
  const dayTotal = event ? eventDayCount(event.start_date, event.end_date ?? null) : 1;
  const gridTemplateColumns = [
    'minmax(0, 2fr)', 'minmax(70px, 1fr)', 'minmax(120px, 1fr)', 'minmax(112px, 1fr)',
    ...(event?.requires_checkin_form ? ['90px'] : []),
    ...(canManagePoints ? ['90px'] : []),
  ].join(' ');

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> All Events</button>
      <div>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : !event || !tickets ? (
          <Loading label="Loading check-ins…" />
        ) : (
          <>
            <div className={checkinStyles.header} style={{ marginBottom: '1.5rem' }}>
              <h1 className={checkinStyles.title}>{event.title}</h1>
              <p className={checkinStyles.sub}>
                {formatEventDateRange(event.start_date, event.end_date, { weekday: true })}
                {event.location && ` · ${event.location}`}
              </p>
            </div>

            <div className={checkinStyles.statsRow}>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{activeTickets.length}</div>
                <div className={checkinStyles.statLabel}>Registered</div>
              </div>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{checkedInCount}</div>
                <div className={checkinStyles.statLabel}>Checked In</div>
              </div>
              <div className={checkinStyles.statCard}>
                <div className={checkinStyles.statValue}>{attendanceRate}%</div>
                <div className={checkinStyles.statLabel}>Attendance</div>
              </div>
              <Link href="/portal/checkin" className={checkinStyles.scanBtn}>
                <Camera size={16} strokeWidth={1.5} aria-hidden="true" /> Open Scanner
              </Link>
            </div>

            {tickets.length === 0 ? (
              <div className={checkinStyles.empty}>No one has registered for this event yet.</div>
            ) : (
              <>
              <div className={styles.toolbar}>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or gamer tag…" aria-label="Search attendees" />
                <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
                  {SORTS.map((x) => <option key={x.key} value={x.key}>Sort: {x.label}</option>)}
                </Select>
                <button type="button" className={styles.dir} aria-label={desc ? 'Descending, switch to ascending' : 'Ascending, switch to descending'} onClick={() => setDesc(!desc)}>
                  {desc ? <ArrowDown size={15} aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
                </button>
                <Select value={group} onChange={(e) => setGroup(e.target.value as GroupKey)} aria-label="Group by">
                  <option value="none">Group: None</option>
                  <option value="status">Group: Status</option>
                  {event.requires_checkin_form && <option value="form">Group: AS form</option>}
                </Select>
              </div>
              {shown.every((g) => g.rows.length === 0) && <div className={checkinStyles.empty}>No one matches.</div>}
              {shown.map((g) => g.rows.length === 0 ? null : (
              <div key={g.title} className={styles.group}>
              {g.title && <h3 className={styles.groupHead}>{g.title} <span>{g.rows.length}</span></h3>}
              <div className={checkinStyles.table}>
                <div className={checkinStyles.tableHeader} style={{ gridTemplateColumns }}>
                  <span>Attendee</span>
                  <span>Registered</span>
                  <span>Status</span>
                  <span>Checked In</span>
                  {event.requires_checkin_form && <span>AS Form</span>}
                  {canManagePoints && <span></span>}
                </div>
                {g.rows.map((t) => {
                  const user = Array.isArray(t.user) ? t.user[0] : t.user;
                  const avatarUrl = user ? resolveAvatarUrl(user) : null;
                  return (
                    <div key={t.id} className={checkinStyles.tableRow} style={{ gridTemplateColumns }}>
                      <div className={checkinStyles.attendee}>
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" width={32} height={32} className={checkinStyles.avatar} unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <div className={checkinStyles.avatarFallback}>{(user?.display_name || '?')[0].toUpperCase()}</div>
                        )}
                        <div>
                          <div className={checkinStyles.name}>{user?.display_name || 'Anonymous'}</div>
                          {user?.gamer_tag && <div className={checkinStyles.gamerTag}><Gamepad2 size={12} strokeWidth={1.5} aria-hidden="true" /> {user.gamer_tag}</div>}
                        </div>
                      </div>
                      <span className={checkinStyles.date}>
                        {new Date(t.created_at).toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`${checkinStyles.badge} ${checkinStyles[`status_${t.status}`]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span className={checkinStyles.date}>
                        {t.checked_in_at
                          ? new Date(t.checked_in_at).toLocaleTimeString('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: '2-digit' })
                          : '—'}
                        {dayTotal > 1 && !!t.days_attended && <span className={checkinStyles.checkinSub}> · {t.days_attended}/{dayTotal} days</span>}
                      </span>
                      {event.requires_checkin_form && (
                        <span>
                          {t.status !== 'used' ? (
                            <span className={styles.formDash}>—</span>
                          ) : t.checkin_form_completed_at ? (
                            <span className={styles.formDone}><Check size={12} strokeWidth={2} aria-hidden="true" /> Opened</span>
                          ) : (
                            <span className={styles.formPending}>Not opened</span>
                          )}
                        </span>
                      )}
                      {canManagePoints && (
                        <span>
                          {t.status === 'used' && !(dayTotal > 1 && !t.checked_in_today) ? (
                            <button
                              type="button"
                              className={styles.uncheckBtn}
                              onClick={() => setUndoTargetId(t.id)}
                              disabled={uncheckingId === t.id}
                            >
                              <Undo2 size={12} strokeWidth={1.75} aria-hidden="true" /> {uncheckingId === t.id ? '…' : 'Undo'}
                            </button>
                          ) : t.status === 'active' || t.status === 'used' ? (
                            <button
                              type="button"
                              className={styles.checkInBtn}
                              onClick={() => handleManualCheckIn(t.id)}
                              disabled={checkingInId === t.id}
                              title="Check in without scanning a QR code or online code"
                            >
                              <Check size={12} strokeWidth={2} aria-hidden="true" /> {checkingInId === t.id ? '…' : 'Check In'}
                            </button>
                          ) : null}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
              ))}
              </>
            )}
          </>
        )}
      </div>
      {undoTargetId && (
        <UndoCheckinModal
          name={(() => { const u = tickets?.find((t) => t.id === undoTargetId)?.user; return (Array.isArray(u) ? u[0] : u)?.display_name ?? undefined; })()}
          busy={uncheckingId === undoTargetId}
          onConfirm={() => handleUncheckIn(undoTargetId)}
          onCancel={() => setUndoTargetId(null)}
        />
      )}
    </div>
  );
}
