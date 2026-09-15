'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './new/newevent.module.css';

export interface EventFormValues {
  title: string;
  content: string;
  location: string;
  start_date: string;
  end_date: string;
  flyer_url: string;
  max_capacity: string;
  requires_ticket: boolean;
  ticket_price: string;
  audience: 'public' | 'ucsd_only';
  is_published: boolean;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  content: '',
  location: '',
  start_date: '',
  end_date: '',
  flyer_url: '',
  max_capacity: '',
  requires_ticket: false,
  ticket_price: '0',
  audience: 'public',
  is_published: false,
};

export default function EventForm({
  heading,
  initial,
  submitLabel,
  onSubmit,
}: {
  heading: string;
  initial: EventFormValues;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | void>;
}) {
  const [form, setForm] = useState<EventFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof EventFormValues, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const err = await onSubmit(form);
    setSaving(false);
    if (err) setError(err);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/portal/events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>{heading}</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Event Title *</span>
          <input className={styles.input} value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={120} />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Start Date & Time *</span>
            <input className={styles.input} type="datetime-local" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>End Date & Time</span>
            <input className={styles.input} type="datetime-local" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Location</span>
          <input className={styles.input} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Price Center Ballroom" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <textarea className={`${styles.input} ${styles.textarea}`} value={form.content} onChange={(e) => set('content', e.target.value)} rows={5} />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Flyer URL</span>
            <input className={styles.input} type="url" value={form.flyer_url} onChange={(e) => set('flyer_url', e.target.value)} placeholder="https://…" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Max Capacity</span>
            <input className={styles.input} type="number" min="1" value={form.max_capacity} onChange={(e) => set('max_capacity', e.target.value)} placeholder="Unlimited" />
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Audience</span>
          <select
            className={styles.input}
            value={form.audience}
            onChange={(e) => set('audience', e.target.value as 'public' | 'ucsd_only')}
          >
            <option value="public">Open to the public</option>
            <option value="ucsd_only">UCSD-affiliated only</option>
          </select>
        </label>

        <div className={styles.checkboxGroup}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={form.requires_ticket} onChange={(e) => set('requires_ticket', e.target.checked)} />
            <span>Requires ticket / registration</span>
          </label>
          {form.requires_ticket && form.audience === 'public' && (
            <label className={styles.field}>
              <span className={styles.label}>Ticket Price for non-UCSD attendees ($)</span>
              <input className={styles.input} type="number" min="0" step="0.01" value={form.ticket_price} onChange={(e) => set('ticket_price', e.target.value)} />
              <span className={styles.hint}>UCSD-affiliated attendees (@ucsd.edu) always get a free ticket.</span>
            </label>
          )}
        </div>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
          <span>Publish immediately (visible to all)</span>
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Link href="/portal/events" className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
