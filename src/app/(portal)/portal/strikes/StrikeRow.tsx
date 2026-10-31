'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Input, Select } from '@/components/ui/Field';
import styles from './tracker.module.css';
import { Strike, Voucher } from './types';
import { catLabel, day } from './format';
import { StrikeForm } from './StrikeForm';

export function StrikeRow({
  s,
  readOnly,
  unusedVouchers,
  busy,
  onAct,
}: {
  s: Strike;
  readOnly: boolean;
  unusedVouchers: Voucher[];
  busy: boolean;
  onAct: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<null | 'remove' | 'voucher' | 'reinstate'>(null);
  const [note, setNote] = useState('');
  const [voucherId, setVoucherId] = useState(unusedVouchers[0]?.id ?? '');
  const chip = s.status === 'published' ? styles.stOn : styles.stOff;
  return (
    <li className={`${styles.strike} ${s.status === 'removed' ? styles.strikeOff : ''}`}>
      <div className={styles.strikeTop}>
        <span className={`${styles.status} ${chip}`}>
          {s.status === 'published' ? 'On their record' : s.removed_how === 'voucher' ? 'Removed with voucher' : s.removed_how === 'reset' ? 'Cleared by a reset' : 'Taken off'}
        </span>
        <span className={styles.cat}>{catLabel(s.category)}</span>
        {s.mark && (
          <span className={styles.cat}>
            <b>{s.mark}</b>
          </span>
        )}
        <time>{day(s.incident_date)}</time>
      </div>
      {editing ? (
        <StrikeForm
          initialReason={s.reason}
          initialDate={s.incident_date}
          initialCategory={s.category}
          submit="Save"
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (reason, date, category) => {
            if (await onAct({ action: 'edit', reason, incident_date: date, category })) setEditing(false);
          }}
        />
      ) : (
        <p className={styles.reason}>{s.reason}</p>
      )}
      <p className={styles.meta}>
        {s.created_by ? `Added by ${s.created_by}` : ''}
        {s.removed_by ? ` · removed by ${s.removed_by}` : ''}
        {s.removed_note ? ` · “${s.removed_note}”` : ''}
      </p>
      {!readOnly && !editing && (
        <div className={styles.rowActions}>
          {s.status === 'published' && (
            <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'remove' ? null : 'remove')}>
              Take away
            </Button>
          )}
          {s.status === 'published' && unusedVouchers.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'voucher' ? null : 'voucher')}>
              <Ticket size={14} aria-hidden="true" /> Use a voucher now
            </Button>
          )}
          {s.status === 'removed' && (
            <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'reinstate' ? null : 'reinstate')}>
              Reinstate
            </Button>
          )}
          {s.status !== 'removed' && <IconButton kind="edit" size="sm" label="Edit this strike" onClick={() => setEditing(true)} />}
        </div>
      )}
      {mode === 'remove' && (
        <form
          className={styles.inline}
          onSubmit={async (e) => {
            e.preventDefault();
            if ((await note.trim()) && (await onAct({ action: 'remove', reason: note.trim() }))) {
              setMode(null);
              setNote('');
            }
          }}
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Why it’s being taken off (they will see this)"
            aria-label="Why it is being taken off"
            required
            autoFocus
          />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>
            Take away
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
        </form>
      )}
      {mode === 'voucher' && (
        <form
          className={styles.inline}
          onSubmit={async (e) => {
            e.preventDefault();
            if (voucherId && note.trim() && (await onAct({ action: 'apply_voucher', voucher_id: voucherId, reason: note.trim() }))) {
              setMode(null);
              setNote('');
            }
          }}
        >
          <Select className={styles.select} value={voucherId} onChange={(e) => setVoucherId(e.target.value)} aria-label="Which voucher">
            {unusedVouchers.map((v) => (
              <option key={v.id} value={v.id}>
                Voucher from {day(v.created_at.slice(0, 10))}
                {v.reason ? ` · ${v.reason}` : ''}
              </option>
            ))}
          </Select>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Why (they will see this)"
            aria-label="Why the voucher is being used"
            required
          />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>
            Remove with voucher
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
        </form>
      )}
      {mode === 'reinstate' && (
        <form
          className={styles.inline}
          onSubmit={async (e) => {
            e.preventDefault();
            if (note.trim() && (await onAct({ action: 'reinstate', reason: note.trim() }))) {
              setMode(null);
              setNote('');
            }
          }}
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Why it’s being put back (they will see this)"
            aria-label="Why it is being put back"
            required
            autoFocus
          />
          <Button type="submit" size="sm" loading={busy} disabled={!note.trim()}>
            Reinstate
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
        </form>
      )}
    </li>
  );
}
