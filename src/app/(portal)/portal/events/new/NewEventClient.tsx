'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import styles from './newevent.module.css';

export default function NewEventClient() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    content: '',
    location: '',
    start_date: '',
    end_date: '',
    flyer_url: '',
    max_capacity: '',
    requires_ticket: false,
    ticket_price: '0',
    is_published: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { error: err } = await supabase.from('events').insert({
      title: form.title.trim(),
      content: form.content.trim() || null,
      location: form.location.trim() || null,
      start_date: new Date(form.start_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      flyer_url: form.flyer_url.trim() || null,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      requires_ticket: form.requires_ticket,
      ticket_price: form.requires_ticket ? parseFloat(form.ticket_price) : 0,
      is_published: form.is_published,
      created_by: user.id,
    });

    setSaving(false);
    if (err) {
      setError('Failed to create event. Please try again.');
    } else {
      router.push('/portal/events');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link href="/portal/events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>Create Event</h1>
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

        <div className={styles.checkboxGroup}>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={form.requires_ticket} onChange={(e) => set('requires_ticket', e.target.checked)} />
            <span>Requires ticket / registration</span>
          </label>
          {form.requires_ticket && (
            <label className={styles.field}>
              <span className={styles.label}>Ticket Price ($)</span>
              <input className={styles.input} type="number" min="0" step="0.01" value={form.ticket_price} onChange={(e) => set('ticket_price', e.target.value)} />
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
            {saving ? 'Creating…' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
