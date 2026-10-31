'use client';

import { pacificToday } from '@/lib/core/timezone';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { DateInput, Field, Input } from '@/components/ui/Field';
import styles from './tracker.module.css';
import { CategorySelect } from './CategorySelect';

export function StrikeForm({
  initialReason = '',
  initialDate,
  initialCategory = 'other',
  submit,
  hint,
  busy,
  onSave,
  onCancel,
}: {
  initialReason?: string;
  initialDate?: string;
  initialCategory?: string;
  submit: string;
  hint?: string;
  busy: boolean;
  onSave: (reason: string, date: string, category: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState(initialReason);
  const [date, setDate] = useState(initialDate ?? pacificToday());
  const [category, setCategory] = useState(initialCategory);
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSave(reason.trim(), date, category);
      }}
    >
      <div className={styles.twoCol}>
        <Field label="What kind">
          <CategorySelect value={category} onChange={setCategory} />
        </Field>
        <Field label="Date it happened">
          <DateInput value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <Field label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Missed the Gen Meeting without an excuse" required autoFocus />
      </Field>
      {hint && <p className={styles.hint}>{hint}</p>}
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
