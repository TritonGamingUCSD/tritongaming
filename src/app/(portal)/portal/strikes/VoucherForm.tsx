'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import styles from './tracker.module.css';

export function VoucherForm({ hasStrikes, busy, onSave, onCancel }: { hasStrikes: boolean; busy: boolean; onSave: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSave(reason.trim());
      }}
    >
      <Field label="Why they earned it (they will see this)">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Ran the tabling shift" required autoFocus />
      </Field>
      <p className={styles.hint}>
        {hasStrikes
          ? 'They already have a strike, so this voucher removes their oldest one right away.'
          : 'They have no strikes, so it is kept and used automatically the next time one is published.'}
      </p>
      <div className={styles.formActions}>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>
          Give voucher
        </Button>
      </div>
    </form>
  );
}
