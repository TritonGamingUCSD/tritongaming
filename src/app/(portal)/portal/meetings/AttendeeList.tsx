'use client';

import { useState } from 'react';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import styles from './meetings.module.css';
import { Live, Person } from './types';
import { time } from './format';
import { Avatar } from './Avatar';
import { CheckTile } from './CheckTile';

export function AttendeeList({
  live,
  onAdd,
  onRemove,
  onAbsent,
  onClearAbsent,
}: {
  live: Live;
  onAdd: (p: Person) => void;
  onRemove: (p: Person) => void;
  onAbsent: (p: Person, reason: string, excused: boolean) => void;
  onClearAbsent: (p: Person) => void;
}) {
  // Which person's "mark absent" form is open.
  const [absentFor, setAbsentFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [excused, setExcused] = useState(true);
  function openAbsent(p: Person) {
    setAbsentFor(p.id);
    setReason('');
    setExcused(true);
  }
  return (
    <div className={styles.lists}>
      <section>
        <h3 className={styles.listTitle}>
          Here <span>{live.attendees.length}</span>
        </h3>
        {live.attendees.length === 0 ? (
          <p className={styles.muted}>Nobody yet.</p>
        ) : (
          <ul className={styles.people}>
            {live.attendees.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>
                  {p.name}
                  {p.guest && (
                    <span className={styles.guestTag} title="Not on the list, counts as +1">
                      +1
                    </span>
                  )}
                  {p.method === 'manual' && <em> · added by exec</em>}
                  {p.method === 'host' && <em> · host (automatic)</em>}
                </span>
                <span className={styles.personTime}>{time(p.checked_in_at)}</span>
                <IconButton kind="remove" size="sm" label={`Remove ${p.name}`} onClick={() => onRemove(p)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className={styles.listTitle}>
          Not here yet <span>{live.missing.length}</span>
        </h3>
        {live.missing.length === 0 ? (
          <p className={styles.muted}>Everyone is accounted for.</p>
        ) : (
          <ul className={styles.people}>
            {live.missing.map((p) => (
              <li key={p.id} className={styles.personCol}>
                <div className={styles.personRow}>
                  <Avatar p={p} />
                  <span className={styles.personName}>{p.name}</span>
                  <IconButton kind="checkin" label={`Check in ${p.name}`} onClick={() => onAdd(p)} />
                  <IconButton
                    kind="absent"
                    label={`Mark ${p.name} absent`}
                    active={absentFor === p.id}
                    onClick={() => (absentFor === p.id ? setAbsentFor(null) : openAbsent(p))}
                    aria-expanded={absentFor === p.id}
                  />
                </div>
                {absentFor === p.id && (
                  <form
                    className={styles.absentForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      onAbsent(p, reason, excused);
                      setAbsentFor(null);
                    }}
                  >
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (optional), e.g. exam, sick"
                      maxLength={140}
                      aria-label={`Why ${p.name} is absent`}
                      autoFocus
                    />
                    <CheckTile label="Excused" checked={excused} onChange={() => setExcused((v) => !v)} />
                    <Button type="submit" size="sm">
                      Mark absent
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {live.absent.length > 0 && (
        <section className={styles.listWide}>
          <h3 className={styles.listTitle}>
            Marked absent <span>{live.absent.length}</span>
          </h3>
          <ul className={styles.people}>
            {live.absent.map((p) => (
              <li key={p.id} className={styles.person}>
                <Avatar p={p} />
                <span className={styles.personName}>
                  {p.name}
                  {p.reason && <em> · {p.reason}</em>}
                </span>
                <span className={`${styles.pill} ${p.excused ? styles.pillDone : ''}`}>{p.excused ? 'Excused' : 'Absent'}</span>
                <IconButton kind="remove" size="sm" label={`Undo absence for ${p.name}`} onClick={() => onClearAbsent(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
