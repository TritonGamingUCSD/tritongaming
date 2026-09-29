'use client';

import { useState } from 'react';
import Link from 'next/link';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import SocialEmbedsField from '@/components/SocialEmbedsField/SocialEmbedsField';
import type { SocialEmbed } from '@/types/database';
import styles from './new/newevent.module.css';

export interface EventFormValues {
  title: string;
  slug: string;
  content: string;
  details: string;
  location: string;
  start_date: string;
  end_date: string;
  flyer_url: string;
  max_capacity: string;
  ticket_price: string;
  points_value: string;
  is_online: boolean;
  audience: 'public' | 'ucsd_only';
  is_published: boolean;
  photo_album_url: string;
  post_event_info: string;
  social_embeds: SocialEmbed[];
  division_id: string;
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  slug: '',
  content: '',
  details: '',
  location: '',
  start_date: '',
  end_date: '',
  flyer_url: '',
  max_capacity: '',
  ticket_price: '0',
  points_value: '10',
  is_online: false,
  audience: 'public',
  is_published: false,
  photo_album_url: '',
  post_event_info: '',
  social_embeds: [],
  division_id: '',
};

// Markdown, not raw HTML — see MarkdownContent for why. "Write"/"Preview"
// tabs so an admin can check formatting without saving and reloading the
// public page in another tab.
function MarkdownField({
  label,
  hint,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  hint?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  return (
    <div className={styles.field}>
      <div className={styles.mdFieldHeader}>
        <span className={styles.label}>{label}</span>
        <div className={styles.mdTabs}>
          <button type="button" className={`${styles.mdTab} ${tab === 'write' ? styles.mdTabActive : ''}`} onClick={() => setTab('write')}>
            Write
          </button>
          <button type="button" className={`${styles.mdTab} ${tab === 'preview' ? styles.mdTabActive : ''}`} onClick={() => setTab('preview')}>
            Preview
          </button>
        </div>
      </div>
      {tab === 'write' ? (
        <textarea
          className={`${styles.input} ${styles.textarea}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
        />
      ) : (
        <div className={styles.mdPreview} style={{ minHeight: `${rows * 1.6}em` }}>
          {value.trim() ? <MarkdownContent>{value}</MarkdownContent> : <span className={styles.mdPreviewEmpty}>Nothing to preview yet.</span>}
        </div>
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}


export default function EventForm({
  heading,
  initial,
  submitLabel,
  onSubmit,
  divisions,
}: {
  heading: string;
  initial: EventFormValues;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | void>;
  divisions: { id: string; name: string }[];
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
        <Link href="/portal?section=events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>{heading}</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Event Title *</span>
          <input className={styles.input} value={form.title} onChange={(e) => set('title', e.target.value)} required maxLength={120} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>URL Slug</span>
          <input className={styles.input} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Auto-generated from title if left blank" maxLength={120} />
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
          <input className={styles.input} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder={form.is_online ? 'e.g. Discord — #main-stage' : 'e.g. Price Center Ballroom'} />
        </label>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.is_online} onChange={(e) => set('is_online', e.target.checked)} />
          <span>This event is online</span>
        </label>
        <span className={styles.hint} style={{ marginTop: '-0.75rem' }}>
          Changes how attendees check in: in-person events get the QR scanner, online events get a check-in code they type in themselves.
        </span>

        <label className={styles.field}>
          <span className={styles.label}>Division</span>
          <select className={styles.input} value={form.division_id} onChange={(e) => set('division_id', e.target.value)}>
            <option value="">None — general club event</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <span className={styles.hint}>Tags this event on that division&apos;s public page under &quot;Upcoming Events&quot;.</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Short Summary</span>
          <textarea className={`${styles.input} ${styles.textarea}`} value={form.content} onChange={(e) => set('content', e.target.value)} rows={3} />
          <span className={styles.hint}>Shown on event cards on the homepage and /events list.</span>
        </label>

        <MarkdownField
          label="Event Details / Instructions"
          value={form.details}
          onChange={(v) => set('details', v)}
          rows={8}
          hint={<>The full write-up shown on this event&apos;s own page (what &quot;Learn More&quot; links to). Markdown supported — **bold**, _italic_, [links](https://…), lists, headings.</>}
        />

        <ImageUploadField
          label="Flyer Image"
          value={form.flyer_url}
          onChange={(v) => set('flyer_url', v)}
          bucket="event-flyers"
          shape="wide"
          hint="PNG, JPEG, WEBP, or GIF. Max 8MB."
        />

        <SocialEmbedsField
          value={form.social_embeds}
          onChange={(v) => setForm((f) => ({ ...f, social_embeds: v }))}
          hint="Shown on this event's own page. Instagram, X, TikTok, and YouTube embed live; Discord links show as a card."
        />

        <label className={styles.field}>
          <span className={styles.label}>Max Capacity</span>
          <input className={styles.input} type="number" min="1" value={form.max_capacity} onChange={(e) => set('max_capacity', e.target.value)} placeholder="Unlimited" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Points for Checking In</span>
          <input className={styles.input} type="number" min="0" value={form.points_value} onChange={(e) => set('points_value', e.target.value)} />
          <span className={styles.hint}>How many reward points an attendee earns the moment they're checked in at this event.</span>
        </label>

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

        {form.audience === 'public' && (
          <label className={styles.field}>
            <span className={styles.label}>Ticket Price for non-UCSD attendees ($)</span>
            <input className={styles.input} type="number" min="0" step="0.01" value={form.ticket_price} onChange={(e) => set('ticket_price', e.target.value)} />
            <span className={styles.hint}>Every published event gets a ticket automatically. UCSD-affiliated attendees (@ucsd.edu) always get a free ticket.</span>
          </label>
        )}

        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
          <span>Publish immediately (visible to all)</span>
        </label>

        <div className={styles.sectionDivider}>
          <span className={styles.sectionLabel}>After the Event</span>
          <span className={styles.hint}>Fill these in once the event has happened — they appear on the event&apos;s page in place of the ticket button.</span>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Photo Album Link</span>
          <input className={styles.input} type="url" value={form.photo_album_url} onChange={(e) => set('photo_album_url', e.target.value)} placeholder="https://photos.google.com/…" />
        </label>

        <MarkdownField
          label="Post-Event Notes"
          value={form.post_event_info}
          onChange={(v) => set('post_event_info', v)}
          rows={4}
          placeholder="Recap, results, thank-yous, etc."
          hint="Markdown supported, same as Event Details above."
        />

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Link href="/portal?section=events" className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
