'use client';

import { formatPacificDate, pacificToday, addDaysKey } from '@/lib/core/timezone';
import Loading from '@/components/Loading/Loading';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Repeat, AlertCircle } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import WeekHead from '@/components/ui/WeekHead';
import { startsWeekGroup, weekGroup } from '@/lib/events/weekGroups';
import { confirmHold } from '@/lib/ui/confirmHold';
import { audienceLabel } from '@/lib/meetings/meetingAudience';
import { qPayload } from './QuestionParts';
import { useVisiblePoll } from '@/lib/ui/useVisiblePoll';
import styles from './meetings.module.css';
import Dialog from '@/components/ui/Dialog';
import { DetailsFields, Item, Series } from './types';
import { WEEKDAYS, dayLabel, hhmmLabel } from './format';
import { audPayload, wholeTeamAud } from './audience';
import { MeetingCard } from './MeetingCard';
import { MeetingEditPage } from './MeetingEditPage';
import { ScheduleForm } from './ScheduleForm';

export function MeetingList({
  onOpen,
  view,
  onView,
  showForm,
  onShowForm,
}: {
  onOpen: (id: string) => void;
  view: string | null | undefined;
  onView: (v: string | null) => void;
  showForm: boolean;
  onShowForm: (v: boolean) => void;
}) {
  const [data, setData] = useState<{ series: Series[]; upcoming: Item[]; past: Item[] } | null>(null);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const setShowForm = onShowForm;
  // The full edit page: a week's meeting (its key) or a repeating meeting (its id).
  // The edit page is in the address too: `edit-<week key>` or `edit-series-<id>`.
  const editing = view?.startsWith('edit-series-') ? { item: null, series: view.slice(12) } : view?.startsWith('edit-') ? { item: view.slice(5), series: null } : null;
  const setEditing = (e: { item: string | null; series: string | null } | null) => onView(!e ? null : e.series ? `edit-series-${e.series}` : `edit-${e.item}`);
  const itemKey = (it: Item) => (it.series_id ? `${it.series_id}|${it.date}` : it.key);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meetings/schedule', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setData(json);
      else setError(json.error || 'Failed to load.');
    } catch {
      setError('Network error.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useVisiblePoll(load, 120_000);

  async function post(url: string, body: unknown, key: string): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    setBusyKey(key);
    setError('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setError((json.error as string) || 'Something went wrong.');
      return { ok: res.ok, json };
    } finally {
      setBusyKey(null);
    }
  }

  async function start(item: Item) {
    const r = await post('/api/meetings/open', item.meeting_id ? { meeting_id: item.meeting_id } : { series_id: item.series_id, date: item.date }, item.key);
    if (r.ok) onOpen(r.json.id as string);
  }
  async function cancel(item: Item, undo = false) {
    if (
      !undo &&
      !(await confirmHold({
        title: `Skip ${item.title} on ${dayLabel(item.date)}?`,
        message: item.repeats ? 'It stays on the list as skipped, and you can restore it.' : 'This removes the meeting.',
        confirmLabel: 'Hold to skip',
      }))
    )
      return;
    const r = await post('/api/meetings/cancel', item.meeting_id ? { meeting_id: item.meeting_id, undo } : { series_id: item.series_id, date: item.date, undo }, item.key);
    if (r.ok) load();
  }
  async function remove(item: Item) {
    if (!item.meeting_id) return;
    const stillComes = item.repeats && item.date >= pacificToday();
    const msg = `${item.count > 0 ? `This also deletes its ${item.count} check-in${item.count === 1 ? '' : 's'} from the attendance records. ` : ''}${stillComes ? 'It repeats weekly, so it will reappear on the list as scheduled; use Skip to keep it off. ' : ''}${item.status === 'open' ? 'Check-in is open right now. ' : ''}This can’t be undone.`;
    if (!(await confirmHold({ title: `Delete ${item.title} on ${dayLabel(item.date)}?`, message: msg, confirmLabel: 'Hold to delete' }))) return;
    setBusyKey(item.key);
    setError('');
    const res = await fetch(`/api/meetings/${item.meeting_id}`, { method: 'DELETE' });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed to delete.');
    setBusyKey(null);
    load();
  }
  async function saveDoc(item: Item, f: DetailsFields): Promise<boolean> {
    // The question is locked once check-in has been opened; leave it out so an unrelated edit can't trip that.
    // Title only changes for one-off meetings (a repeating meeting keeps its name every week).
    const fields = {
      doc_url: f.doc,
      ...(item.status === 'open' ? {} : qPayload(f.q)),
      location: f.location,
      ...(item.repeats ? {} : { title: f.title }),
      start: f.start,
      end: f.end,
      ...audPayload(f.audience),
    };
    const r = await post(
      '/api/meetings/update',
      item.meeting_id ? { meeting_id: item.meeting_id, ...fields } : { series_id: item.series_id, date: item.date, ...fields },
      item.key,
    );
    if (r.ok) load();
    return r.ok;
  }
  async function patchSeries(s: Series, body: Record<string, unknown>): Promise<boolean> {
    setBusyKey(s.id);
    setError('');
    const res = await fetch(`/api/meetings/series/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Failed.');
    setBusyKey(null);
    load();
    return res.ok;
  }
  async function deleteSeries(s: Series) {
    if (
      !(await confirmHold({ title: `Delete “${s.title}”?`, message: 'It stops repeating. Meetings already held and their attendance are kept.', confirmLabel: 'Hold to delete' }))
    )
      return;
    setBusyKey(s.id);
    await fetch(`/api/meetings/series/${s.id}`, { method: 'DELETE' });
    setBusyKey(null);
    load();
  }

  if (!data) return error ? <Notice tone="error">{error}</Notice> : <Loading label="Loading meetings…" />;

  if (editing) {
    const it = editing.item ? (data.upcoming.find((x) => itemKey(x) === editing.item) ?? null) : null;
    const sr = data.series.find((x) => x.id === (editing.series ?? it?.series_id)) ?? null;
    if (it || sr)
      return (
        <MeetingEditPage
          key={`${editing.item}|${editing.series}`}
          item={it}
          series={sr}
          busy={busyKey === (it?.key ?? sr?.id)}
          onBack={() => setEditing(null)}
          onSaveItem={async (f) => {
            const ok = it ? await saveDoc(it, f) : false;
            if (ok) setEditing(null);
            return ok;
          }}
          onSaveSeries={(body) => (sr ? patchSeries(sr, body) : Promise.resolve(false))}
          onChanged={load}
        />
      );
  }

  const todayKey = pacificToday();
  const todayItems = data.upcoming.filter((it) => it.date === todayKey);
  const laterItems = data.upcoming.filter((it) => it.date !== todayKey);
  const soonItems = laterItems.filter((it) => weekGroup(it.date) <= 1),
    farItems = laterItems.filter((it) => weekGroup(it.date) > 1);
  const renderCard = (it: Item) => (
    <MeetingCard
      key={itemKey(it)}
      item={it}
      busy={busyKey === it.key}
      onStart={() => start(it)}
      onView={() => it.meeting_id && onOpen(it.meeting_id)}
      onCancel={(undo) => cancel(it, undo)}
      onEdit={() => setEditing({ item: itemKey(it), series: null })}
      onDelete={() => remove(it)}
    />
  );
  // What a host should look at: a meeting in the next week with no room or no doc yet.
  const weekEnd = addDaysKey(todayKey, 7);
  const attention = data.upcoming
    .filter((it) => it.status !== 'cancelled' && it.date <= weekEnd && (!it.location || !it.doc_url))
    .map((it) => ({
      key: itemKey(it),
      title: it.title,
      day: it.date === todayKey ? 'Today' : dayLabel(it.date).split(',')[0],
      what: !it.location && !it.doc_url ? 'No room or doc yet' : !it.location ? 'No room yet' : 'No doc yet',
    }));

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <p className={styles.muted}>Open a meeting on its day for its code.</p>
      </div>
      {showForm && (
        <Dialog title="Schedule A Meeting" wide onClose={() => setShowForm(false)}>
          <ScheduleForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </Dialog>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {attention.length > 0 && (
        <section className={styles.attention} aria-label="Needs attention">
          <h3 className={styles.listTitle}>
            Needs Attention <span>{attention.length}</span>
          </h3>
          <ul>
            {attention.slice(0, 5).map((x) => (
              <li key={x.key}>
                <AlertCircle size={14} aria-hidden="true" />
                <span>
                  <strong>{x.title}</strong> · {x.day} · {x.what}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setEditing({ item: x.key, series: null })}>
                  Fix
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {todayItems.length > 0 && (
        <section>
          <h3 className={styles.listTitle}>
            Today <span>{dayLabel(todayKey)}</span>
          </h3>
          <ul className={styles.meetingList}>{todayItems.map(renderCard)}</ul>
        </section>
      )}

      <section>
        <h3 className={styles.listTitle}>
          {todayItems.length > 0 ? 'Coming Up' : 'Upcoming'} <span>this week and next</span>
        </h3>
        {soonItems.length === 0 ? (
          <p className={styles.muted}>Nothing else this week or next.</p>
        ) : (
          <ul className={styles.meetingList}>
            {/* A repeating meeting's week keeps the same key before and after its row exists, so an open edit page survives the first save. */}
            {soonItems.map((it, i) => (
              <Fragment key={itemKey(it)}>
                {startsWeekGroup(
                  soonItems.map((x) => x.date),
                  i,
                ) && <WeekHead date={it.date} />}
                {renderCard(it)}
              </Fragment>
            ))}
          </ul>
        )}
        {farItems.length > 0 && (
          <details className={styles.moreOptions}>
            <summary>
              <span>Later</span>
              <em>
                {farItems.length} more {farItems.length === 1 ? 'meeting' : 'meetings'} after next week
              </em>
            </summary>
            <ul className={`${styles.meetingList} ${styles.moreBody}`}>{farItems.map(renderCard)}</ul>
          </details>
        )}
      </section>

      <section>
        <h3 className={styles.listTitle}>Repeating meetings</h3>
        {data.series.length === 0 ? (
          <p className={styles.muted}>None yet.</p>
        ) : (
          <ul className={styles.people}>
            {data.series
              .filter((s) => !s.ended)
              .map((s) => (
                <li key={s.id} className={`${styles.seriesRow} ${s.active ? '' : styles.paused}`}>
                  <Repeat size={16} aria-hidden="true" className={styles.seriesIcon} />
                  <span className={styles.personName}>
                    {s.title}
                    <em className={styles.seriesDetail}>
                      every {WEEKDAYS[s.weekday]} {hhmmLabel(s.start_time)}–{hhmmLabel(s.end_time)}
                      {s.location ? ` · ${s.location}` : ''}
                      {s.ends_on ? ` · until ${formatPacificDate(s.ends_on)}` : ''} · {audienceLabel(s)}
                      {s.active ? '' : ' · paused'}
                    </em>
                    {s.open_to_team === false && !wholeTeamAud(s) && (
                      <span className={`${styles.accessChip} ${styles.accessChipLimited}`} title="Only the people it is for can check in">
                        Private Meeting
                      </span>
                    )}
                  </span>
                  <IconButton kind="edit" label={`Edit ${s.title}`} onClick={() => setEditing({ item: null, series: s.id })} />
                  <IconButton
                    kind={s.active ? 'pause' : 'play'}
                    label={s.active ? `Pause ${s.title}` : `Resume ${s.title}`}
                    onClick={() => patchSeries(s, { active: !s.active })}
                    disabled={busyKey === s.id}
                  />
                  <IconButton kind="delete" label={`Delete ${s.title}`} onClick={() => deleteSeries(s)} disabled={busyKey === s.id} />
                </li>
              ))}
          </ul>
        )}
        {data.series.some((s) => s.ended) && (
          <details className={styles.endedSeries}>
            <summary>
              Ended <span>{data.series.filter((s) => s.ended).length}</span>
            </summary>
            <p className={styles.faint}>These passed their last day. Their past meetings and attendance are kept. To bring one back, edit it and pick a later last day.</p>
            <ul className={styles.people}>
              {data.series
                .filter((s) => s.ended)
                .map((s) => (
                  <li key={s.id} className={`${styles.seriesRow} ${s.active ? '' : styles.paused}`}>
                    <Repeat size={16} aria-hidden="true" className={styles.seriesIcon} />
                    <span className={styles.personName}>
                      {s.title}
                      <em className={styles.seriesDetail}>
                        every {WEEKDAYS[s.weekday]} {hhmmLabel(s.start_time)}–{hhmmLabel(s.end_time)}
                        {s.location ? ` · ${s.location}` : ''}
                        {s.ends_on ? ` · until ${formatPacificDate(s.ends_on)}` : ''} · {audienceLabel(s)}
                        {s.active ? '' : ' · paused'}
                      </em>
                      {s.open_to_team === false && !wholeTeamAud(s) && (
                        <span className={`${styles.accessChip} ${styles.accessChipLimited}`} title="Only the people it is for can check in">
                          Private Meeting
                        </span>
                      )}
                    </span>
                    <IconButton kind="edit" label={`Extend or edit ${s.title}`} onClick={() => setEditing({ item: null, series: s.id })} />

                    <IconButton kind="delete" label={`Delete ${s.title}`} onClick={() => deleteSeries(s)} disabled={busyKey === s.id} />
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      {data.past.length > 0 && (
        // Folded, newest first, one thin line per meeting: this is a lookup, not something to read every day.
        <details className={styles.moreOptions}>
          <summary>
            <span>Recent</span>
            <em>{data.past.length} in the last 30 days</em>
          </summary>
          <ul className={`${styles.people} ${styles.recentList}`}>
            {[...data.past].reverse().map((it) => (
              <li key={it.key} className={styles.person}>
                <span className={styles.recentName}>
                  <strong>{it.title}</strong>
                  <span>{dayLabel(it.date)}</span>
                </span>
                <span className={styles.count}>{it.status === 'closed' || it.count > 0 ? `${it.count} checked in` : 'Not held'}</span>
                {it.meeting_id && (
                  <Button size="sm" variant="ghost" onClick={() => onOpen(it.meeting_id!)}>
                    Attendance
                  </Button>
                )}
                {!!it.meeting_id && <IconButton kind="delete" label={`Delete ${it.title} on ${dayLabel(it.date)}`} onClick={() => remove(it)} />}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
