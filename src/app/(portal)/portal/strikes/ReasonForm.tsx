'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import styles from './tracker.module.css';

export function ReasonForm({
  label,
  placeholder,
  submit,
  busy,
  onSave,
  onCancel,
}: {
  label: string;
  placeholder: string;
  submit: string;
  busy: boolean;
  onSave: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSave(reason.trim());
      }}
    >
      <Field label={label}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={placeholder} required autoFocus />
      </Field>
      <div className={styles.formActions}>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={!reason.trim()}>
          {submit}
        </Button>
      </div>
    </form>
  );
}
