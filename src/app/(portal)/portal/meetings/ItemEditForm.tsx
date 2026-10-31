'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input, TimeInput } from '@/components/ui/Field';
import { QuestionEditor, qFrom, qBad, type QState } from './QuestionParts';
import styles from './meetings.module.css';
import { DetailsFields, Item } from './types';
import { pacificHHMM } from './format';
import { Aud, audFrom, audienceEmpty } from './audience';
import { AudienceField } from './AudienceField';
import { MoreOptions } from './MoreOptions';

// One meeting's own settings (this week only, for a repeating meeting). Saved with the Save button; leaving the page asks nothing because nothing is lost until Save.
export function ItemEditForm({ item, busy, onSave }: { item: Item; busy: boolean; onSave: (f: DetailsFields) => Promise<boolean> }) {
  const [doc, setDoc] = useState(item.doc_url ?? '');
  const [q, setQ] = useState<QState>(qFrom(item));
  const [audience, setAudience] = useState<Aud>(audFrom(item));
  const [room, setRoom] = useState(item.location ?? '');
  const [title, setTitle] = useState(item.title);
  const [startT, setStartT] = useState(pacificHHMM(item.starts_at));
  const [endT, setEndT] = useState(pacificHHMM(item.ends_at));
  const status = item.status;
  return (
    <form
      className={styles.detailsForm}
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({ doc, q, audience, location: room, title, start: startT, end: endT });
      }}
    >
      {!item.repeats && (
        <Field label="Name">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required />
        </Field>
      )}
      <div className={styles.formGrid}>
        <Field label="Starts">
          <TimeInput value={startT} onChange={(e) => setStartT(e.target.value)} required />
        </Field>
        <Field label="Ends">
          <TimeInput value={endT} onChange={(e) => setEndT(e.target.value)} required />
        </Field>
      </div>
      <AudienceField value={audience} onChange={setAudience} />
      <MoreOptions filled={[room && 'Room', doc && 'Doc', q.text && 'Question'].filter(Boolean) as string[]}>
        <Field label="Room for this meeting" hint="Only changes this one meeting.">
          <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Price Center East" maxLength={80} />
        </Field>
        <Field label="Meeting doc link">
          <Input value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="https://docs.google.com/… or /portal/docs" inputMode="url" />
        </Field>
        <Field label="Question of the meeting" hint={status === 'open' ? 'Locked while check-in is open.' : undefined}>
          <QuestionEditor value={q} onChange={setQ} disabled={status === 'open'} />
        </Field>
      </MoreOptions>
      <div className={styles.formActions}>
        <Button type="submit" loading={busy} disabled={audienceEmpty(audience) || qBad(q)}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
