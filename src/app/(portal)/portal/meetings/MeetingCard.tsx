'use client';

import { pacificToday } from '@/lib/core/timezone';
import Popover from '@/components/ui/Popover';
import { useRef, useState } from 'react';
import { Radio, ClipboardList, FileText, Repeat, MapPin, SkipForward, RotateCcw, Link2, MessageCircleQuestion, Users, UserX, MoreHorizontal, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { weekGroup } from '@/lib/events/weekGroups';
import { audienceLabel } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import { WEEK_TONE, time, timeRange } from './format';
import { Item } from './types';
import { useNow } from './hooks';
import { wholeTeamAud } from './audience';

export function MeetingCard({
  item,
  busy,
  past,
  onStart,
  onView,
  onCancel,
  onEdit,
  onDelete,
}: {
  item: Item;
  busy: boolean;
  past?: boolean;
  onStart: () => void;
  onView: () => void;
  onCancel: (undo: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = item.status;
  // The clock decides what to say: an exec can open check-in early, but members only get in from
  // 10 minutes before the start, so "Open now" means members can actually check in right now.
  const now = useNow();
  const opensAt = new Date(item.starts_at).getTime() - 10 * 60_000;
  const label =
    status === 'cancelled'
      ? 'Skipped'
      : status === 'closed'
        ? `${item.count} checked in`
        : status === 'open'
          ? now >= opensAt
            ? 'Check-in open'
            : `Opens ${time(new Date(opensAt).toISOString())}`
          : item.is_today
            ? now > new Date(item.ends_at).getTime() + 30 * 60_000
              ? 'Not held'
              : now >= opensAt
                ? 'Ready to open'
                : `Today ${time(item.starts_at)}`
            : 'Scheduled';

  // One main button per row; everything else lives in the ⋯ menu.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const canEditDetails = !past && status !== 'cancelled';
  const canSkip = !past && status === 'scheduled' && !!item.repeats;
  // Any meeting that has ended can be deleted. Coming weeks of a repeating meeting use Skip (or delete the whole repeating meeting).
  const canDelete = !!item.meeting_id && (!item.repeats || !!past || item.date < pacificToday());
  const primaryAction =
    !past && status === 'open' ? (
      <Button size="sm" onClick={onView}>
        <Radio size={14} aria-hidden="true" /> Show code
      </Button>
    ) : !past && status === 'cancelled' ? (
      <Button size="sm" variant="secondary" onClick={() => onCancel(true)} loading={busy}>
        <RotateCcw size={14} aria-hidden="true" /> Restore
      </Button>
    ) : !past && item.is_today ? (
      <Button size="sm" onClick={onStart} loading={busy}>
        {status === 'closed' ? 'Re-open' : 'Start check-in'}
      </Button>
    ) : (past || status === 'closed') && item.meeting_id ? (
      <Button size="sm" variant="secondary" onClick={onView}>
        Attendance
      </Button>
    ) : null;
  // A meeting that is closed today has Re-open as its main button; its attendance is then one tap away in the menu.
  const attendanceInMenu = !!item.meeting_id && status === 'closed' && !past && item.is_today;
  const hasMenu = (primaryAction ? canEditDetails : false) || attendanceInMenu || canSkip || canDelete;

  return (
    <li
      data-tone={status === 'cancelled' ? 'off' : status === 'open' ? 'open' : past ? 'done' : item.is_today ? 'today' : WEEK_TONE[weekGroup(item.date)]}
      className={`${styles.meetingCard} ${status === 'cancelled' ? styles.skipped : ''} ${status === 'open' ? styles.cardOpen : ''} ${status === 'cancelled' ? styles.paused : ''}`}
    >
      <div className={styles.meetingMain}>
        <span className={`${styles.dateBlock} ${item.is_today ? styles.dateToday : ''}`} aria-hidden="true">
          <small>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' })}</small>
          <b>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', day: 'numeric' })}</b>
        </span>
        <div className={styles.meetingInfo}>
          <strong>
            {item.title}
            {item.repeats && <Repeat size={12} aria-label="Repeats weekly" className={styles.inlineIcon} />}
          </strong>
          <span className={styles.metaLine}>
            <span>
              <strong className={styles.metaDay}>
                {item.is_today ? 'Today' : new Date(`${item.date}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })}
              </strong>{' '}
              {timeRange(item.starts_at, item.ends_at)}
            </span>
            {item.location && (
              <span>
                <MapPin size={11} aria-hidden="true" className={styles.inlineIcon} /> {item.location}
              </span>
            )}
          </span>
          <span className={`${styles.metaLine} ${styles.metaSub}`}>
            <span className={styles.metaAudience} title={`For: ${audienceLabel(item)}`}>
              <Users size={11} aria-hidden="true" /> {audienceLabel(item)}
            </span>
            {item.open_to_team === false && !wholeTeamAud(item) && (item.status === 'scheduled' || item.status === 'open') && (
              <span className={`${styles.accessChip} ${styles.accessChipLimited}`} title="Only the people it is for can check in">
                Private Meeting
              </span>
            )}
            {item.doc_url && (
              <span className={styles.metaDoc}>
                <Link2 size={11} aria-hidden="true" /> Doc
              </span>
            )}
            {item.question && (
              <span className={styles.metaDoc}>
                <MessageCircleQuestion size={11} aria-hidden="true" /> Question
              </span>
            )}
            {(item.absent ?? 0) > 0 && (
              <span className={styles.metaAway} title="People who said they can't make it">
                <UserX size={11} aria-hidden="true" /> {item.absent} away
              </span>
            )}
            {item.host_name && <span className={styles.metaHost}>Created by {item.host_name}</span>}
          </span>
        </div>
        <span className={`${styles.pill} ${status === 'open' && now >= opensAt ? styles.pillOpen : status === 'closed' ? styles.pillDone : ''}`}>{label}</span>
        <div className={styles.cardActions}>
          {primaryAction}
          {!primaryAction && canEditDetails && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <FileText size={14} aria-hidden="true" /> Details
            </Button>
          )}
          {hasMenu && (
            <>
              <button
                ref={menuRef}
                type="button"
                className={styles.moreBtn}
                aria-label={`More For ${item.title}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {menuOpen && (
                <Popover anchor={menuRef} onClose={() => setMenuOpen(false)} width={190} label="Meeting actions">
                  <div className={styles.moreMenu} role="menu">
                    {primaryAction && canEditDetails && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit();
                        }}
                      >
                        <FileText size={14} aria-hidden="true" /> Details
                      </button>
                    )}
                    {attendanceInMenu && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onView();
                        }}
                      >
                        <ClipboardList size={14} aria-hidden="true" /> Attendance
                      </button>
                    )}
                    {canSkip && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onCancel(false);
                        }}
                      >
                        <SkipForward size={14} aria-hidden="true" /> Skip This Week
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.moreDanger}
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete();
                        }}
                        disabled={busy}
                      >
                        <Trash2 size={14} aria-hidden="true" /> Delete
                      </button>
                    )}
                  </div>
                </Popover>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}
