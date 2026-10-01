'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import MarkdownContent from '@/components/MarkdownContent/MarkdownContent';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import SocialEmbedsField from '@/components/SocialEmbedsField/SocialEmbedsField';
import PhotoAlbumsField from '@/components/PhotoAlbumsField/PhotoAlbumsField';
import { buildCheckinFormUrl } from '@/lib/checkinForm';
import type { SocialEmbed, PhotoAlbumEntry, AppRole } from '@/types/database';
import CheckinFormFieldsEditor, { EMPTY_CHECKIN_FORM_CONFIG, type CheckinFormConfigValue } from './CheckinFormFieldsEditor';
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
  photo_albums: PhotoAlbumEntry[];
  post_event_info: string;
  social_embeds: SocialEmbed[];
  division_id: string;
  requires_checkin_form: boolean;
  checkin_food_item: string;
  checkin_form_event_name: string;
  // This event's own AS Form config (link, question IDs, answer mappings) —
  // see CheckinFormFieldsEditor. null only while "Requires AS Form" is off;
  // there's no site-wide default any more, the form differs per event.
  checkin_form_override: CheckinFormConfigValue | null;
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
  photo_albums: [],
  post_event_info: '',
  social_embeds: [],
  division_id: '',
  requires_checkin_form: false,
  checkin_food_item: '',
  checkin_form_event_name: '',
  checkin_form_override: null,
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
  seedCheckinFormConfig,
  previewViewer,
}: {
  heading: string;
  initial: EventFormValues;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | void>;
  divisions: { id: string; name: string }[];
  // Starting point for a new event's AS Form config: the most recent event's
  // answer mappings, with the link/question IDs blank (see
  // getCheckinFormSeed). The form link is per event — there's no site-wide one.
  seedCheckinFormConfig?: CheckinFormConfigValue | null;
  // The signed-in person's own year/roles, so "Preview AS Form" is what
  // *they'd* see as an attendee (see getFormPreviewViewer).
  previewViewer?: { year: string | null; roles: AppRole[] };
}) {
  const [form, setForm] = useState<EventFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field: keyof EventFormValues, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Turning "Requires AS Form" on starts this event's own config from the
  // seed (or empty) so the editor always has something to edit.
  useEffect(() => {
    if (form.requires_checkin_form && form.checkin_form_override === null) {
      setForm((f) => ({ ...f, checkin_form_override: seedCheckinFormConfig ?? EMPTY_CHECKIN_FORM_CONFIG }));
    }
  }, [form.requires_checkin_form, form.checkin_form_override, seedCheckinFormConfig]);

  // Preview uses this event's own config only (same as what attendees get —
  // see getTicketsData), with a representative sample year/role rather than
  // a real attendee's, since it's just "does the mapping actually work".
  const checkinPreviewConfig = form.checkin_form_override ?? null;
  const checkinPreviewUrl = form.requires_checkin_form && checkinPreviewConfig
    ? buildCheckinFormUrl(checkinPreviewConfig, {
        eventTitle: form.checkin_form_event_name.trim() || form.title || 'Test Event',
        year: previewViewer?.year ?? null,
        roles: previewViewer?.roles ?? [],
        foodItem: form.checkin_food_item.trim() || null,
      })
    : null;

  // The AS Form's event question is a pick-list of every club's events
  // ("Org - Event name"). Read the live list from the form itself so an admin
  // picks the exact option instead of typing it — a one-character mismatch
  // would silently stop the prefill. Null until loaded / if it can't be read
  // (then the plain text box below is the fallback).
  const asFormUrl = checkinPreviewConfig?.form_url?.trim() || '';
  const asFormEventEntry = checkinPreviewConfig?.entry_event_name || '';
  const [asFormEventOptions, setAsFormEventOptions] = useState<string[] | null>(null);
  useEffect(() => {
    setAsFormEventOptions(null);
    if (!form.requires_checkin_form || !asFormUrl || !asFormEventEntry) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/checkin-form/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ form_url: asFormUrl }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const q = (data.questions as { entryId: string; options: string[] | null }[]).find((x) => x.entryId === asFormEventEntry);
        if (!cancelled && q?.options?.length) setAsFormEventOptions(q.options);
      } catch {
        // fall back to the text box
      }
    })();
    return () => { cancelled = true; };
  }, [form.requires_checkin_form, asFormUrl, asFormEventEntry]);

  // Options from our own org float to the top; best guess at this event's
  // entry is the one sharing the most words with its title.
  const { ownOptions, otherOptions, suggestion } = useMemo(() => {
    if (!asFormEventOptions) return { ownOptions: [] as string[], otherOptions: [] as string[], suggestion: null as string | null };
    const isOwn = (o: string) => o.toLowerCase().startsWith('triton gaming');
    const own = asFormEventOptions.filter(isOwn);
    const other = asFormEventOptions.filter((o) => !isOwn(o));
    const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && w !== 'triton' && w !== 'gaming'));
    const titleWords = words(form.title);
    let best: string | null = null;
    let bestScore = 0;
    for (const o of own) {
      const ow = words(o);
      let score = 0;
      titleWords.forEach((w) => { if (ow.has(w)) score++; });
      if (score > bestScore) { bestScore = score; best = o; }
    }
    // A single Triton Gaming entry on the form is an obvious match even with
    // no shared words.
    const pick = bestScore > 0 ? best : own.length === 1 ? own[0] : null;
    return { ownOptions: own, otherOptions: other, suggestion: pick };
  }, [asFormEventOptions, form.title]);
  const eventNameOnForm = form.checkin_form_event_name.trim();
  const eventNameMissing = !!asFormEventOptions && !!eventNameOnForm && !asFormEventOptions.includes(eventNameOnForm);

  // Once the form's options load, pre-select the best match for an event
  // that has none yet — still changeable in the dropdown. (Never overwrites
  // a value that's already set.)
  const autoPickedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!suggestion || autoPickedFor.current === suggestion) return;
    autoPickedFor.current = suggestion; // once per suggestion, so clearing it stays cleared
    setForm((f) => (f.checkin_form_event_name.trim() ? f : { ...f, checkin_form_event_name: suggestion }));
  }, [suggestion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // An end time at or before the start (e.g. "12:30 AM" typed on the same
    // date for a night event) would close ticketing and check-in before the
    // event even began — catch it here instead of silently saving it.
    if (form.start_date && form.end_date && new Date(`${form.end_date}:00Z`).getTime() <= new Date(`${form.start_date}:00Z`).getTime()) {
      setError('The end time must be after the start time. For an event that runs past midnight, set the end date to the next day.');
      return;
    }
    if (form.requires_checkin_form && !form.checkin_form_override?.form_url?.trim()) {
      setError("This event requires the AS Form — paste its form link first (or turn off “Requires AS Form”).");
      return;
    }
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

        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.requires_checkin_form} onChange={(e) => set('requires_checkin_form', e.target.checked)} />
          <span>Requires AS Form</span>
        </label>
        <span className={styles.hint} style={{ marginTop: '-0.75rem' }}>
          Shows a pre-filled AS Form button on the attendee's own phone the moment an officer checks them in. UCSD
          makes a new form for each event, so paste this event's link below.
        </span>

        {form.requires_checkin_form && (
          <>
            <div className={styles.sectionDivider}>
              <span className={styles.sectionLabel}>This Event's AS Form</span>
              <CheckinFormFieldsEditor
                value={form.checkin_form_override ?? seedCheckinFormConfig ?? EMPTY_CHECKIN_FORM_CONFIG}
                onChange={(v) => setForm((f) => ({ ...f, checkin_form_override: v }))}
              />
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Event on the AS Form</span>
              {asFormEventOptions ? (
                <select className={styles.input} value={form.checkin_form_event_name} onChange={(e) => set('checkin_form_event_name', e.target.value)}>
                  <option value="">— Pick this event from the AS Form's list —</option>
                  {eventNameMissing && <option value={form.checkin_form_event_name}>{form.checkin_form_event_name} (not on the form)</option>}
                  {ownOptions.length > 0 && (
                    <optgroup label="Triton Gaming">
                      {ownOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                  )}
                  {otherOptions.length > 0 && (
                    <optgroup label="Other clubs' events">
                      {otherOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </optgroup>
                  )}
                </select>
              ) : (
                <input className={styles.input} value={form.checkin_form_event_name} onChange={(e) => set('checkin_form_event_name', e.target.value)} placeholder="Exactly as listed on the AS Form, e.g. Triton Gaming - Fall GBM 2026" />
              )}
              {suggestion && !eventNameOnForm && (
                <button type="button" className={styles.previewBtn} style={{ marginTop: '0.4rem' }} onClick={() => set('checkin_form_event_name', suggestion)}>
                  Use “{suggestion}”
                </button>
              )}
              {eventNameMissing && (
                <span className={styles.hint} style={{ color: '#f59e0b' }}>
                  ⚠ That option isn't on the AS Form right now — UCSD may not have added this event yet. Attendees would have to pick it themselves.
                </span>
              )}
              {asFormEventOptions && !eventNameOnForm && !suggestion && (
                <span className={styles.hint} style={{ color: '#f59e0b' }}>
                  ⚠ No Triton Gaming event on the form looks like this one. If UCSD hasn't added it yet, it can't be pre-selected.
                </span>
              )}
              <span className={styles.hint}>The AS Form now makes people pick their event from a list of every club's events. Choosing it here pre-selects it for attendees. Must be the exact option text — the dropdown is read live from the form.</span>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Food/Item Provided</span>
              <input className={styles.input} value={form.checkin_food_item} onChange={(e) => set('checkin_food_item', e.target.value)} placeholder="e.g. Pizza & boba, T-shirts" />
              <span className={styles.hint}>Pre-fills the AS Form's "food or item received" question. Leave blank if nothing was given out.</span>
            </label>

            {checkinPreviewUrl ? (
              <a href={checkinPreviewUrl} target="_blank" rel="noopener noreferrer" className={styles.previewBtn}>
                <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" /> Preview AS Form
              </a>
            ) : (
              <span className={styles.hint}>Paste this event's form link above to enable a preview.</span>
            )}
          </>
        )}

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

        <PhotoAlbumsField
          value={form.photo_albums}
          onChange={(v) => setForm((f) => ({ ...f, photo_albums: v }))}
        />

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
