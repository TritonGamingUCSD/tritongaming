'use client';

import { pacificToday } from '@/lib/core/timezone';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input, Select, DateInput, TimeInput } from '@/components/ui/Field';
import styles from './meetings.module.css';
import { Series } from './types';
import { WEEKDAYS } from './format';
import { Aud, audFrom, audPayload, audienceEmpty } from './audience';
import { SeriesExcused } from './SeriesExcused';
import { AudienceField } from './AudienceField';
import { MoreOptions } from './MoreOptions';

// Edit a repeating meeting itself: its name, day, times, room, doc and who it's for.
export function SeriesEditForm({
  series: s,
  busy,
  onSave,
  onCancel,
}: {
  series: Series;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(s.title);
  const [weekday, setWeekday] = useState(String(s.weekday));
  const [start, setStart] = useState(s.start_time.slice(0, 5));
  const [end, setEnd] = useState(s.end_time.slice(0, 5));
  const [room, setRoom] = useState(s.location ?? '');
  const [doc, setDoc] = useState(s.doc_url ?? '');
  const [endsOn, setEndsOn] = useState(s.ends_on ?? '');
  const [audience, setAudience] = useState<Aud>(audFrom(s));
  const bad = !title.trim() || end <= start || audienceEmpty(audience);
  return (
    <form
      className={`${styles.detailsForm} ${styles.seriesForm}`}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ title, weekday: Number(weekday), start, end, location: room, doc_url: doc, ends_on: endsOn || null, ...audPayload(audience) });
      }}
    >
      <p className={styles.faint}>Applies to the series and coming weeks. A week you edited on its own keeps its changes.</p>
      <div className={styles.formGrid}>
        <Field label="Name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
        </Field>
        <Field label="Day of the week">
          <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starts">
          <TimeInput value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="Ends">
          <TimeInput value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <AudienceField value={audience} onChange={setAudience} />
      <MoreOptions filled={[room && 'Room', endsOn && 'Ends ' + endsOn, doc && 'Doc'].filter(Boolean) as string[]}>
        <Field label="Room" hint="The default for every week.">
          <Input value={room} onChange={(e) => setRoom(e.target.value)} maxLength={80} placeholder="e.g. Price Center East" />
        </Field>
        <Field label="Last meeting on (optional)" hint="After this day it stops showing up in the portal. Blank means it keeps going.">
          <DateInput value={endsOn} min={pacificToday()} onChange={(e) => setEndsOn(e.target.value)} />
        </Field>
        <Field label="Meeting doc link">
          <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/…" inputMode="url" />
        </Field>
      </MoreOptions>
      <SeriesExcused seriesId={s.id} />
      {end <= start && <p className={styles.checkWarn}>Pick an end time after the start.</p>}
      <div className={styles.formActions}>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={bad}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
