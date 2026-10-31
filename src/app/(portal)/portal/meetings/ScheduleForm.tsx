'use client';

import { pacificToday } from '@/lib/core/timezone';
import { useState } from 'react';
import { Repeat } from 'lucide-react';
import Notice from '@/components/ui/Notice';
import Button from '@/components/ui/Button';
import { Field, Input, Select, DateInput, TimeInput } from '@/components/ui/Field';
import { QuestionEditor, emptyQ, qPayload, type QState } from './QuestionParts';
import styles from './meetings.module.css';
import { WEEKDAYS } from './format';
import { Aud, audPayload, audienceEmpty, defaultAud } from './audience';
import { AudienceField } from './AudienceField';
import { MoreOptions } from './MoreOptions';

export function ScheduleForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<'weekly' | 'once'>('weekly');
  const [weekday, setWeekday] = useState('5');
  const [date, setDate] = useState(pacificToday());
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('18:00');
  const [location, setLocation] = useState('');
  const [doc, setDoc] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [q, setQ] = useState<QState>(emptyQ);
  const [audience, setAudience] = useState<Aud>(defaultAud());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/meetings/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          repeat,
          weekday: Number(weekday),
          date,
          start,
          end,
          location,
          doc_url: doc,
          ...qPayload(q),
          ends_on: repeat === 'weekly' ? endsOn || null : null,
          ...audPayload(audience),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Failed to schedule.');
        return;
      }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Button
        size="sm"
        variant="secondary"
        className={styles.presetBtn}
        onClick={() => {
          setTitle('Gen Meeting');
          setRepeat('weekly');
          setWeekday('5');
          setStart('17:00');
          setEnd('18:00');
        }}
      >
        <Repeat size={14} aria-hidden="true" /> Use the Gen Meeting setup (every Friday, 5–6 PM)
      </Button>
      <div className={styles.formGrid}>
        <Field label="Name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gen Meeting" maxLength={60} required />
        </Field>
        <Field label="Repeats">
          <Select value={repeat} onChange={(e) => setRepeat(e.target.value as 'weekly' | 'once')}>
            <option value="weekly">Every week</option>
            <option value="once">Just once</option>
          </Select>
        </Field>
        {repeat === 'weekly' ? (
          <Field label="Day of the week">
            <Select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Date">
            <DateInput value={date} min={pacificToday()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        )}
        <Field label="Starts">
          <TimeInput value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <Field label="Ends">
          <TimeInput value={end} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <AudienceField value={audience} onChange={setAudience} />
      <MoreOptions
        filled={[repeat === 'weekly' && endsOn && 'Ends ' + endsOn, location && 'Room', doc && 'Doc', repeat === 'once' && q.text && 'Question'].filter(Boolean) as string[]}
      >
        {repeat === 'weekly' && (
          <Field label="Last meeting on (optional)" hint="Blank means it keeps going until you stop it.">
            <DateInput value={endsOn} min={pacificToday()} onChange={(e) => setEndsOn(e.target.value)} />
          </Field>
        )}
        <Field
          label={repeat === 'weekly' ? 'Usual room (optional)' : 'Room (optional)'}
          hint={repeat === 'weekly' ? 'Just the default — change the room for any single week from its Details.' : undefined}
        >
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} />
        </Field>
        <Field
          label="Meeting doc link (optional)"
          hint="Members it is meant for see the link as soon as you add it. For a repeating meeting this is the default; change it for any single week."
        >
          <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/…" inputMode="url" />
        </Field>
        {repeat === 'once' && (
          <Field label="Question of the meeting (optional)" hint="An icebreaker people answer after checking in. You can also set it on the day.">
            <QuestionEditor value={q} onChange={setQ} placeholder="What game have you put the most hours into?" />
          </Field>
        )}
      </MoreOptions>
      <p className={styles.faint}>Times are Pacific. Repeating meetings appear two weeks ahead.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <div className={styles.formActions}>
        <Button type="submit" loading={busy} disabled={audienceEmpty(audience)}>
          {repeat === 'weekly' ? 'Schedule weekly meeting' : 'Schedule meeting'}
        </Button>
      </div>
    </form>
  );
}
