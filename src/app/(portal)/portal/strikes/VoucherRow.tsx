'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Field';
import styles from './tracker.module.css';
import { Voucher } from './types';
import { day } from './format';

export function VoucherRow({
  v,
  readOnly,
  busy,
  onRemove,
}: {
  v: Voucher;
  readOnly: boolean;
  busy: boolean;
  onRemove: (reason: string) => Promise<Record<string, unknown> | null>;
}) {
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const off = !!v.used_at || !!v.removed_at;
  return (
    <li className={off ? styles.vUsed : ''}>
      <Ticket size={14} aria-hidden="true" />
      <span>
        <b>{v.removed_at ? 'Removed' : v.used_at ? 'Used' : 'Unused'}</b> · given {day(v.created_at.slice(0, 10))}
        {v.given_by ? ` by ${v.given_by}` : ''}
        {v.reason ? ` · ${v.reason}` : ''}
        {v.used_at ? ` · used ${day(v.used_at.slice(0, 10))}` : ''}
        {v.removed_at ? ` · removed ${day(v.removed_at.slice(0, 10))}${v.removed_by ? ` by ${v.removed_by}` : ''}${v.removed_reason ? ` · “${v.removed_reason}”` : ''}` : ''}
      </span>
      {!off && !readOnly && !asking && <IconButton kind="remove" size="sm" label="Remove this voucher" onClick={() => setAsking(true)} />}
      {asking && (
        <form
          className={styles.inline}
          onSubmit={async (e) => {
            e.preventDefault();
            if (reason.trim() && (await onRemove(reason.trim()))) setAsking(false);
          }}
        >
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="Why it’s being removed (they will see this)"
            aria-label="Why the voucher is being removed"
            required
            autoFocus
          />
          <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>
            Remove
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>
            Cancel
          </Button>
        </form>
      )}
    </li>
  );
}
