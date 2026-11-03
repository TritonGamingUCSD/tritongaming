'use client';

import DetailHeader from '@/components/ui/DetailHeader';
import Loading from '@/components/Loading/Loading';
import { useCallback, useEffect, useState } from 'react';
import { Moon, RotateCcw, Plus, Ticket } from 'lucide-react';
import Button from '@/components/ui/Button';
import Notice from '@/components/ui/Notice';
import { confirmHold } from '@/lib/ui/confirmHold';
import { STRIKES_AT_LIMIT } from '@/lib/members/strikeLabels';
import styles from './tracker.module.css';
import { Event, Person, Strike, Voucher } from './types';
import { EVENT_LABEL, day } from './format';
import { Avatar } from './Avatar';
import { Pips } from './Pips';
import { VoucherRow } from './VoucherRow';
import { StrikeRow } from './StrikeRow';
import { StrikeForm } from './StrikeForm';
import { ReasonForm } from './ReasonForm';
import { VoucherForm } from './VoucherForm';

// One person's record: strikes, vouchers and history, with everything HR can do.
export function PersonDetail({ person, limit, me, onBack, onChanged }: { person: Person; limit: number; me: string; onBack: () => void; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<{ strikes: Strike[]; vouchers: Voucher[]; events: Event[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [giving, setGiving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const isMe = person.id === me;

  const reload = useCallback(async () => {
    const r = await fetch(`/api/strikes/people/${person.id}`, { cache: 'no-store' });
    if (r.ok) setData(await r.json());
    await onChanged();
  }, [person.id, onChanged]);
  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/strikes/people/${person.id}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    })();
  }, [person.id]);

  async function act(path: string, method: string, body?: unknown, key = path): Promise<Record<string, unknown> | null> {
    setBusy(key);
    setError('');
    setNote('');
    try {
      const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.error || 'That didn’t work.');
        return null;
      }
      await reload();
      return j;
    } finally {
      setBusy('');
    }
  }
  const strikes = data?.strikes ?? [];
  const vouchers = data?.vouchers ?? [];
  const events = data?.events ?? [];
  const unused = vouchers.filter((v) => !v.used_at && !v.removed_at);
  return (
    <section className={styles.detail} aria-label={`${person.name}'s record`}>
      <DetailHeader
        back={{ label: 'All People', onClick: onBack }}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.7rem' }}>
            <Avatar name={person.name} src={person.avatar_url} />
            {person.name}
          </span>
        }
        chip={person.role}
        actions={<Pips active={person.active} limit={limit} />}
      />
      {person.atLimit && <p className={styles.limit}>At {STRIKES_AT_LIMIT} strikes. They’ve been told the HR team will contact them.</p>}
      {isMe && <Notice tone="warning">This is your own record. You can look, but someone else has to change it.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="success">{note}</Notice>}

      {person.inactive && (
        <p className={styles.idleNote}>
          <Moon size={14} aria-hidden="true" /> Inactive this quarter: no new strikes, and their record and vouchers stay as they are.
        </p>
      )}
      {!isMe && (
        <div className={styles.actionsBar}>
          {!person.inactive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAdding((v) => !v);
                setGiving(false);
              }}
              aria-expanded={adding}
            >
              <Plus size={14} aria-hidden="true" /> Add a strike
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setGiving((v) => !v);
              setAdding(false);
            }}
            aria-expanded={giving}
          >
            <Ticket size={14} aria-hidden="true" /> Give a voucher
          </Button>
          {person.active > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setResetting((v) => !v);
                setAdding(false);
                setGiving(false);
              }}
              aria-expanded={resetting}
            >
              <RotateCcw size={14} aria-hidden="true" /> Reset
            </Button>
          )}
        </div>
      )}
      {adding && (
        <StrikeForm
          submit="Add strike"
          hint="It goes on their record right away and they get a notification. If they have a voucher, it is used on this strike."
          onCancel={() => setAdding(false)}
          busy={busy === 'new'}
          onSave={async (reason, date, category) => {
            const j = await act('/api/strikes', 'POST', { user_id: person.id, reason, incident_date: date, category }, 'new');
            if (j) {
              setAdding(false);
              if (j.voucherUsed) setNote('Added. Their voucher was used on it, so it doesn’t count.');
            }
          }}
        />
      )}
      {resetting && (
        <ReasonForm
          label={`Why you’re resetting ${person.name}’s strikes (they will see this)`}
          placeholder="e.g. Fall quarter reset"
          submit="Reset their strikes"
          busy={busy === 'reset'}
          onCancel={() => setResetting(false)}
          onSave={async (reason) => {
            if (
              !(await confirmHold({
                title: `Reset ${person.name}’s strikes?`,
                message:
                  'This permanently deletes their strikes, warning and history. Nobody can open it afterwards, not even an admin. They only see your reason. Their unused vouchers are kept.',
                confirmLabel: 'Hold to reset',
              }))
            )
              return;
            if (await act('/api/strikes/reset', 'POST', { user_id: person.id, reason }, 'reset')) {
              setResetting(false);
              setNote('Their record was deleted for good.');
            }
          }}
        />
      )}
      {giving && (
        <VoucherForm
          hasStrikes={person.active > 0}
          busy={busy === 'voucher'}
          onCancel={() => setGiving(false)}
          onSave={async (reason) => {
            const j = await act('/api/strikes/vouchers', 'POST', { user_id: person.id, reason }, 'voucher');
            if (j) {
              setGiving(false);
              if (j.usedOnStrike) setNote('Voucher given. It removed their oldest strike right away.');
            }
          }}
        />
      )}

      <h3 className={styles.h3}>Strikes</h3>
      {data === null ? (
        <Loading variant="inline" label="Loading…" />
      ) : strikes.length === 0 ? (
        <p className={styles.muted}>No strikes.</p>
      ) : (
        <ul className={styles.strikes}>
          {strikes.map((s) => (
            <StrikeRow
              key={s.id}
              s={s}
              readOnly={isMe}
              unusedVouchers={unused}
              busy={busy === s.id}
              onAct={async (body) => !!(await act(`/api/strikes/${s.id}`, 'PATCH', body, s.id))}
            />
          ))}
        </ul>
      )}

      <h3 className={styles.h3}>Vouchers</h3>
      {data === null ? null : vouchers.length === 0 ? (
        <p className={styles.muted}>No vouchers.</p>
      ) : (
        <ul className={styles.vouchers}>
          {vouchers.map((v) => (
            <VoucherRow key={v.id} v={v} readOnly={isMe} busy={busy === v.id} onRemove={(reason) => act(`/api/strikes/vouchers/${v.id}`, 'DELETE', { reason }, v.id)} />
          ))}
        </ul>
      )}

      <h3 className={styles.h3}>History</h3>
      {data === null ? null : events.length === 0 ? (
        <p className={styles.muted}>Nothing yet.</p>
      ) : (
        <ul className={styles.doneList}>
          {events.map((e) => (
            <li key={e.id}>
              <b>{e.kind === 'strike_added' && e.label ? `${e.label} added` : (EVENT_LABEL[e.kind] ?? e.kind)}</b> · {day(e.at.slice(0, 10))}
              {e.by ? ` · by ${e.by}` : ''}
              {e.reason ? ` · “${e.reason}”` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
