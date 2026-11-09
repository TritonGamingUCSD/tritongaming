'use client';

import SectionHeader from '@/components/ui/SectionHeader';
import Notice from '@/components/ui/Notice';
import { showToast } from '@/lib/ui/toast';
import SaveBar from '@/components/portal/SaveBar';
import EditingNow from '@/components/portal/EditingNow';
import { useUnsavedChanges } from '@/lib/ui/useUnsavedChanges';
import { useState } from 'react';
import Link from '@/components/portal/NoPrefetchLink';
import ImageUploadField from '@/components/ImageUploadField/ImageUploadField';
import SocialLinksField from '@/components/SocialLinksField/SocialLinksField';
import SocialEmbedsField from '@/components/SocialEmbedsField/SocialEmbedsField';
import type { SocialEmbed } from '@/types/database';
// Reuses the event form's stylesheet directly rather than a hand-copied
// duplicate — this was the actual ask (editing should *feel* consistent
// with event editing), and the classes here (.page/.form/.field/.input/
// .mdTabs/etc.) were already fully generic, not event-specific. Importing
// the same file guarantees the two never visually drift apart.
import LivePreview from '@/components/portal/LivePreview';
import PageBlocksEditor from '@/components/PageBlocksEditor/PageBlocksEditor';
import type { PageBlock } from '@/lib/site/pageBlocks';
import { ACCENTS } from '@/lib/divisions/accent';
import styles from '../events/new/newevent.module.css';

export interface DivisionFormValues {
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  discord_url: string;
  application_url: string;
  social_links: Record<string, string>;
  social_embeds: SocialEmbed[];
  page_blocks: PageBlock[];
  accent: string;
  tagline: string;
  banner_url: string;
}

// Same Write/Preview markdown field as EventForm.tsx's (not extracted to a
// shared component — that file's own version is the third near-identical
// copy already in this codebase; this is a deliberate fourth rather than
// forcing an extraction as a drive-by of an unrelated feature).
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
      <textarea className={`${styles.input} ${styles.textarea}`} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export default function DivisionForm({
  heading,
  initial,
  submitLabel,
  onSubmit,
  backHref,
  // Renaming/re-slugging is a directory-level (structural) decision — a
  // division lead can shape their own page's content, not its identity or
  // public URL (see the API route's own canManageDirectory gate). false
  // shows the name/slug as read-only text instead of inputs.
  canRename = true,
  divisionId,
  creditPeople = [],
  embedded = false,
}: {
  heading: string;
  /** The division being edited: lets the live preview lay the unsaved form over it. */
  divisionId?: string;
  initial: DivisionFormValues;
  submitLabel: string;
  onSubmit: (values: DivisionFormValues) => Promise<string | void>;
  backHref: string;
  canRename?: boolean;
  creditPeople?: import('@/lib/members/creditPeople').CreditPerson[];
  /** Shown inside a division's own portal page: no back link or title of its own (the page has them). */
  embedded?: boolean;
}) {
  const [form, setForm] = useState<DivisionFormValues>(initial);
  const { dirty, markSaved, saved: savedForm } = useUnsavedChanges(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof DivisionFormValues>(field: K, value: DivisionFormValues[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const err = await onSubmit(form);
    setSaving(false);
    if (err) setError(err);
    else {
      markSaved();
      showToast('Division saved', { nextPage: true });
    }
  }

  return (
    <div className={styles.page} data-wide-page>
      {!embedded && (
        <Link href={backHref} className={styles.back}>
          ← Back to Divisions
        </Link>
      )}
      {!embedded && <SectionHeader title={heading} />}
      <EditingNow room={divisionId ? `division:${divisionId}` : null} what="this division" />

      <div className={styles.editLayout}>
        <form id="division-form" className={styles.form} onSubmit={handleSubmit}>
          {canRename ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>Division Name *</span>
                <input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={80} />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>URL Slug</span>
                <input
                  className={styles.input}
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="Auto-generated from name if left blank"
                  maxLength={80}
                />
                <span className={styles.hint}>/divisions/{form.slug || '…'}</span>
              </label>
            </>
          ) : (
            <div className={styles.field}>
              <span className={styles.label}>Division</span>
              <span className={styles.hint}>
                {form.name} — /divisions/{form.slug} (only exec/admin can rename or re-slug a division)
              </span>
            </div>
          )}

          <ImageUploadField
            label="Logo"
            value={form.logo_url}
            onChange={(v) => set('logo_url', v)}
            bucket="division-logos"
            pathPrefix={divisionId}
            shape="logo"
            maxDimension={512}
          />

          <ImageUploadField
            label="Banner"
            value={form.banner_url}
            onChange={(v) => set('banner_url', v)}
            bucket="division-logos"
            pathPrefix={divisionId ? `${divisionId}/banner` : 'banner'}
            maxDimension={1600}
          />
          <label className={styles.field}>
            <span className={styles.label}>Tagline</span>
            <input
              className={styles.input}
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              maxLength={120}
              placeholder="One line under the name, like “Smash Fridays, 7pm, Price Center”"
            />
            <span className={styles.hint}>Shown in the hero of the division&apos;s page.</span>
          </label>
          <div className={styles.field}>
            <span className={styles.label}>Color</span>
            <div role="radiogroup" aria-label="Division color" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {ACCENTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  role="radio"
                  aria-checked={(form.accent || 'yellow') === a.key}
                  aria-label={a.label}
                  title={a.label}
                  onClick={() => set('accent', a.key)}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: a.hex,
                    border: (form.accent || 'yellow') === a.key ? '3px solid var(--pp-ink)' : '2px solid rgba(var(--pp-ink-rgb), 0.25)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <span className={styles.hint}>The color of the division&apos;s public page and of its portal.</span>
          </div>

          <MarkdownField
            label="Description"
            value={form.description}
            onChange={(v) => set('description', v)}
            rows={8}
            placeholder="Tell people what this division is about…"
            hint="Shown on this division's own page. Markdown supported — **bold**, _italic_, [links](https://…), lists, headings."
          />

          <label className={styles.field}>
            <span className={styles.label}>Discord Server Invite</span>
            <input className={styles.input} type="url" value={form.discord_url} onChange={(e) => set('discord_url', e.target.value)} placeholder="https://discord.gg/…" />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Officer Application Link</span>
            <input className={styles.input} type="url" value={form.application_url} onChange={(e) => set('application_url', e.target.value)} placeholder="https://forms.gle/…" />
            <span className={styles.hint}>Shown as an "Apply to Be an Officer" button on this division's page.</span>
          </label>

          <SocialLinksField value={form.social_links} onChange={(v) => set('social_links', v)} exclude={['discord']} hint="Just your handle, not the full link — optional." />

          <PageBlocksEditor
            blocks={form.page_blocks}
            onChange={(b) => set('page_blocks', b)}
            page={divisionId ? { type: 'division', id: divisionId } : undefined}
            bucket="site-content"
            creditPeople={creditPeople}
          />

          <SocialEmbedsField
            value={form.social_embeds}
            onChange={(v) => set('social_embeds', v)}
            hint="Shown on this division's own page. Instagram, X, TikTok, and YouTube embed live; Discord links show as a card."
          />

          {error && <Notice tone="error">{error}</Notice>}

          {!embedded && (
            <div className={styles.actions}>
              <Link href={backHref} className={styles.cancelBtn}>
                Back
              </Link>
            </div>
          )}
          <SaveBar
            dirty={dirty}
            saving={saving}
            formId="division-form"
            saveLabel={submitLabel}
            onDiscard={() => {
              setForm(savedForm());
              setError('');
            }}
          />
        </form>
        {divisionId && (
          <div className={styles.editPreview}>
            <LivePreview draftKey="division" path="/preview/divisions/__draft__" label={form.name.trim() || 'Division'} value={{ ...form, id: divisionId }} />
          </div>
        )}
      </div>
    </div>
  );
}
