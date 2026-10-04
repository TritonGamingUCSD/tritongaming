'use client';

import Notice from '@/components/ui/Notice';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import SocialEmbedsField from '@/components/SocialEmbedsField/SocialEmbedsField';
import PhotoAlbumsField from '@/components/PhotoAlbumsField/PhotoAlbumsField';
import { buildCheckinFormUrl } from '@/lib/checkinForm';
import { eventDayCount, pacificDatetimeLocalToUTC } from '@/lib/timezone';
import type { SocialEmbed, PhotoAlbumEntry, AppRole, ScheduleItem, EventSponsor } from '@/types/database';
import EventExtrasEditor from './EventExtrasEditor';
import PageBlocksEditor from '@/components/PageBlocksEditor/PageBlocksEditor';
import type { PageBlock } from '@/lib/pageBlocks';
import EventThemePanel from './EventThemePanel';
import EventPostersField from './EventPostersField';
import { EMPTY_THEME, type EventTheme } from '@/lib/eventTheme';
import CheckinFormFieldsEditor, { EMPTY_CHECKIN_FORM_CONFIG, type CheckinFormConfigValue } from './CheckinFormFieldsEditor';
import LivePreview from '@/components/portal/LivePreview';
import styles from './new/newevent.module.css';
import Select from '@/components/ui/Select';
import SectionTabs from '@/components/ui/SectionTabs';
import { DateTimeInput, TimeInput } from '@/components/ui/Field';
import NumberInput from '@/components/ui/NumberInput';

export interface EventFormValues {
  title: string;
  slug: string;
  content: string;
  details: string;
  location: string;
  venue_address: string;
  venue_notes: string;
  venue_name: string;
  venue_lat: number | null;
  venue_lng: number | null;
  schedule: ScheduleItem[];
  sponsors: EventSponsor[];
  start_date: string;
  end_date: string;
  flyer_url: string;
  ticket_price: string;
  points_value: string;
  is_online: boolean;
  audience: 'public' | 'ucsd_only';
  is_published: boolean;
  photo_albums: PhotoAlbumEntry[];
  post_event_info: string;
  social_embeds: SocialEmbed[];
  theme: EventTheme;
  page_blocks: PageBlock[];
  requires_checkin_form: boolean;
  checkin_food_item: string;
  // Per-day check-in hours for multi-day events (blank start/end = open all day).
  checkin_windows: { day: string; start: string; end: string }[];
  checkin_form_event_name: string;
  // This event's own AS Form config (link, question IDs, answer mappings) —
  // see CheckinFormFieldsEditor. null only while "Requires AS Form" is off;
  // there's no site-wide default any more, the form differs per event.
  checkin_form_override: CheckinFormConfigValue | null;
}

// The calendar days a form's start/end span (Pacific dates straight from the datetime-local values).
export function formDays(start: string, end: string): string[] {
  const s = start.slice(0, 10), e = end.slice(0, 10);
  if (!s || !e || e <= s) return s ? [s] : [];
  const out: string[] = [];
  for (let d = new Date(`${s}T12:00:00Z`); d.toISOString().slice(0, 10) <= e && out.length < 31; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}
// Only days that still exist in the event, with both a start and an end, in a sane order.
export function cleanCheckinWindows(list: { day: string; start: string; end: string }[], start: string, end: string) {
  const days = new Set(formDays(start, end));
  return days.size > 1 ? list.filter((w) => days.has(w.day) && w.start && w.end && w.start < w.end) : [];
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  slug: '',
  content: '',
  details: '',
  location: '',
  venue_address: '',
  venue_notes: '',
  venue_name: '',
  venue_lat: null,
  venue_lng: null,
  schedule: [],
  sponsors: [],
  start_date: '',
  end_date: '',
  flyer_url: '',
  ticket_price: '0',
  points_value: '10',
  is_online: false,
  audience: 'public',
  is_published: false,
  photo_albums: [],
  post_event_info: '',
  social_embeds: [],
  theme: EMPTY_THEME,
  page_blocks: [],
  requires_checkin_form: false,
  checkin_food_item: '',
  checkin_windows: [],
  checkin_form_event_name: '',
  checkin_form_override: null,
};

// Markdown, not raw HTML — see MarkdownContent for why. There is no separate preview here: the live preview beside the form shows the real page.
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
  return (
    <div className={styles.field}>
      <div className={styles.mdFieldHeader}>
        <span className={styles.label}>{label}</span>
      </div>
      <textarea
        className={`${styles.input} ${styles.textarea}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}


type EventTab = 'basics' | 'page' | 'tickets' | 'after';
const EVENT_TABS: { id: EventTab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'page', label: 'Page' },
  { id: 'tickets', label: 'Tickets' },
  { id: 'after', label: 'After' },
];

export default function EventForm({
  heading,
  initial,
  submitLabel,
  onSubmit,
  seedCheckinFormConfig,
  previewViewer,
  stayAfterSave = false,
  creditPeople = [],
}: {
  heading: string;
  initial: EventFormValues;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | void>;
  // Starting point for a new event's AS Form config: the most recent event's
  // answer mappings, with the link/question IDs blank (see
  // getCheckinFormSeed). The form link is per event — there's no site-wide one.
  seedCheckinFormConfig?: CheckinFormConfigValue | null;
  // The signed-in person's own year/roles, so "Preview AS Form" is what
  // *they'd* see as an attendee (see getFormPreviewViewer).
  previewViewer?: { year: string | null; classOf?: number | null; roles: AppRole[] };
  // Editing: stay on the page after saving (the caller does not navigate), and confirm with a toast right here.
  stayAfterSave?: boolean;
  // Officers who can be credited for a poster or sticker (name and link filled in from their profile).
  creditPeople?: import('@/lib/creditPeople').CreditPerson[];
}) {
  // Older events have only a flyer: it becomes poster 1.
  const [form, setForm] = useState<EventFormValues>(() => (initial.theme.posters?.length || !initial.flyer_url ? initial : { ...initial, theme: { ...initial.theme, posters: [initial.flyer_url] } }));
  // Warn before leaving with unsaved edits (links, Back, closing the tab).
  const { markSaved } = useUnsavedChanges(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<EventTab>('basics');
  const formRef = useRef<HTMLFormElement>(null);
  // A required field in a tab that is not showing: jump to that tab and show the browser's message there.
  function onInvalid(e: React.FormEvent) {
    const t = (e.target as HTMLElement).closest('[data-tab]')?.getAttribute('data-tab') as EventTab | null;
    if (t && t !== tab) { setTab(t); requestAnimationFrame(() => formRef.current?.reportValidity()); }
  }

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
        classOf: previewViewer?.classOf ?? null,
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
      setTab('basics');
      setError('The end time must be after the start time. For an event that runs past midnight, set the end date to the next day.');
      return;
    }
    if (!(form.theme.posters ?? []).some(Boolean)) {
      setTab('page');
      setError('Add at least one poster. It is the main picture for this event.');
      return;
    }
    if (form.requires_checkin_form && !form.checkin_form_override?.form_url?.trim()) {
      setTab('tickets');
      setError("This event requires the AS Form — paste its form link first (or turn off “Requires AS Form”).");
      return;
    }
    setSaving(true);
    setError('');
    const err = await onSubmit(form);
    setSaving(false);
    if (err) setError(err);
    else {
      markSaved();
      // These forms navigate away on success, so the confirmation is shown on the next page.
      if (stayAfterSave) showToast('Event saved');
      else showToast(submitLabel.startsWith('Create') ? 'Event created' : 'Event saved', { nextPage: true });
    }
  }

  return (
    <div className={styles.page} data-wide-page>
      <div className={styles.header}>
        <Link href="/portal?section=events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>{heading}</h1>
      </div>

      <div className={styles.editLayout}>
      <form ref={formRef} className={`${styles.form}${saving ? ` ${styles.formSaving}` : ''}`} onSubmit={handleSubmit} onInvalidCapture={onInvalid} aria-busy={saving}>
        <SectionTabs<EventTab> label="Event sections" value={tab} onChange={setTab} tabs={EVENT_TABS} />

        <div data-tab="basics" hidden={tab !== 'basics'} className={styles.tabPanel}>
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
            <DateTimeInput className={styles.input} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>End Date & Time</span>
            <DateTimeInput className={styles.input} value={form.end_date} min={form.start_date} onChange={(e) => set('end_date', e.target.value)} placeholder="Optional" />
          </label>
        </div>
        <p className={styles.hint}>
          {form.start_date && form.end_date && new Date(form.end_date) > new Date(form.start_date)
            ? (() => {
                const days = eventDayCount(pacificDatetimeLocalToUTC(form.start_date).toISOString(), pacificDatetimeLocalToUTC(form.end_date).toISOString());
                return days > 1 ? `Multi-day event: ${days} days. One ticket covers every day, and check-in stays open until the end time.` : 'Single-day event.';
              })()
            : 'Running over several days (like a weekend LAN)? Set the end date to the last day — one ticket covers every day.'}
        </p>

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
          <span className={styles.label}>Short Summary</span>
          <textarea className={`${styles.input} ${styles.textarea}`} value={form.content} onChange={(e) => set('content', e.target.value)} rows={3} />
          <span className={styles.hint}>Shown on event cards on the homepage and /events list.</span>
        </label>

        <label className={styles.checkbox}>
          <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
          <span>Publish immediately (visible to all)</span>
        </label>
        </div>

        <div data-tab="page" hidden={tab !== 'page'} className={styles.tabPanel}>
        <EventPostersField
          people={creditPeople}
          posters={form.theme.posters ?? []}
          credits={form.theme.asset_credits ?? {}}
          onChange={(posters, credits) => setForm((f) => ({ ...f, flyer_url: posters.find(Boolean) ?? '', theme: { ...f.theme, posters, asset_credits: credits } }))}
        />

        <MarkdownField
          label="Event Details / Instructions"
          value={form.details}
          onChange={(v) => set('details', v)}
          rows={8}
          hint={<>The full write-up shown on this event&apos;s own page (what &quot;Learn More&quot; links to). Markdown supported — **bold**, _italic_, [links](https://…), lists, headings.</>}
        />

        <PageBlocksEditor blocks={form.page_blocks} onChange={(b) => setForm((f) => ({ ...f, page_blocks: b }))} />

        <EventExtrasEditor
          venueAddress={form.venue_address}
          venueNotes={form.venue_notes}
          venueName={form.venue_name}
          venuePin={form.venue_lat != null && form.venue_lng != null ? { lat: form.venue_lat, lng: form.venue_lng } : null}
          schedule={form.schedule}
          sponsors={form.sponsors}
          onVenueAddress={(v) => set('venue_address', v)}
          onVenueNotes={(v) => set('venue_notes', v)}
          onVenueName={(v) => set('venue_name', v)}
          onVenuePin={(p) => setForm((f) => ({ ...f, venue_lat: p?.lat ?? null, venue_lng: p?.lng ?? null }))}
          onSchedule={(v) => setForm((f) => ({ ...f, schedule: v }))}
          onSponsors={(v) => setForm((f) => ({ ...f, sponsors: v }))}
        />

        <EventThemePanel theme={form.theme} onChange={(t) => setForm((f) => ({ ...f, theme: t }))} people={creditPeople} />

        <SocialEmbedsField
          value={form.social_embeds}
          onChange={(v) => setForm((f) => ({ ...f, social_embeds: v }))}
          hint="Shown on this event's own page. Instagram, X, TikTok, and YouTube embed live; Discord links show as a card."
        />
        </div>

        <div data-tab="tickets" hidden={tab !== 'tickets'} className={styles.tabPanel}>
        <label className={styles.field}>
          <span className={styles.label}>Audience</span>
          <Select
            className={styles.input}
            value={form.audience}
            onChange={(e) => set('audience', e.target.value as 'public' | 'ucsd_only')}
          >
            <option value="public">Open to the public</option>
            <option value="ucsd_only">UCSD-affiliated only</option>
          </Select>
        </label>

        {form.audience === 'public' && (
          <label className={styles.field}>
            <span className={styles.label}>Ticket Price for non-UCSD attendees ($)</span>
            <NumberInput className={styles.input} min="0" step="0.01" value={form.ticket_price} onChange={(e) => set('ticket_price', e.target.value)} />
            <span className={styles.hint}>Every published event gets a ticket automatically. UCSD-affiliated attendees (@ucsd.edu) always get a free ticket.</span>
          </label>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Points for Checking In</span>
          <NumberInput className={styles.input} min="0" value={form.points_value} onChange={(e) => set('points_value', e.target.value)} />
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
                <Select className={styles.input} value={form.checkin_form_event_name} onChange={(e) => set('checkin_form_event_name', e.target.value)}>
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
                </Select>
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

        {formDays(form.start_date, form.end_date).length > 1 && (
          <div className={styles.field}>
            <span className={styles.label}>Check-in hours for each day <span className={styles.hint}>(optional)</span></span>
            <p className={styles.hint}>Leave a day blank and check-in stays open all day. Set both times to only allow check-in in that window (Pacific time).</p>
            <div>
              {formDays(form.start_date, form.end_date).map((day, i) => {
                const w = form.checkin_windows.find((x) => x.day === day) ?? { day, start: '', end: '' };
                const setW = (patch: Partial<typeof w>) => setForm((f) => ({ ...f, checkin_windows: [...f.checkin_windows.filter((x) => x.day !== day), { ...w, ...patch }] }));
                const bad = !!w.start && !!w.end && w.end <= w.start;
                return (
                  <div key={day} className={styles.row} style={{ alignItems: 'end', marginBottom: '0.5rem' }}>
                    <div className={styles.field}>
                      <span className={styles.label}>Day {i + 1} · {new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}</span>
                      <TimeInput className={styles.input} value={w.start} onChange={(e) => setW({ start: e.target.value })} aria-label={`Day ${i + 1} check-in opens`} />
                    </div>
                    <div className={styles.field}>
                      <span className={styles.label}>{bad ? 'Closes (must be after it opens)' : 'Closes'}</span>
                      <TimeInput className={styles.input} value={w.end} onChange={(e) => setW({ end: e.target.value })} aria-label={`Day ${i + 1} check-in closes`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        <div data-tab="after" hidden={tab !== 'after'} className={styles.tabPanel}>
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
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <div className={styles.actions}>
          <Link href="/portal?section=events" className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? <><Loader2 size={16} className={styles.spin} aria-hidden="true" /> Saving…</> : submitLabel}
          </button>
        </div>
      </form>
      {saving && <div className={styles.savingPill} role="status"><Loader2 size={18} className={styles.spin} aria-hidden="true" /> Saving your event…</div>}
      <div className={styles.editPreview}>
        <LivePreview draftKey="event" path="/preview/events/__draft__" label={form.title.trim() || 'New event'} value={form} />
      </div>
      </div>
    </div>
  );
}
