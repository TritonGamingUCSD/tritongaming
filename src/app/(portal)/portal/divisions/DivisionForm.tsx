'use client';

import Notice from '@/components/ui/Notice';
import { showToast } from '@/lib/toast';
import { useUnsavedChanges } from '@/lib/useUnsavedChanges';
import { useState } from 'react';
import Link from 'next/link';
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
import type { PageBlock } from '@/lib/pageBlocks';
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
}

export const EMPTY_DIVISION_FORM: DivisionFormValues = {
  name: '',
  slug: '',
  description: '',
  logo_url: '',
  discord_url: '',
  application_url: '',
  social_links: {},
  social_embeds: [],
  page_blocks: [],
};

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
}: {
  heading: string;
  /** The division being edited: lets the live preview lay the unsaved form over it. */
  divisionId?: string;
  initial: DivisionFormValues;
  submitLabel: string;
  onSubmit: (values: DivisionFormValues) => Promise<string | void>;
  backHref: string;
  canRename?: boolean;
}) {
  const [form, setForm] = useState<DivisionFormValues>(initial);
  const { markSaved } = useUnsavedChanges(form);
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
      <div className={styles.header}>
        <Link href={backHref} className={styles.back}>← Back to Divisions</Link>
        <h1 className={styles.title}>{heading}</h1>
      </div>

      <div className={styles.editLayout}>
      <form className={styles.form} onSubmit={handleSubmit}>
        {canRename ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Division Name *</span>
              <input className={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={80} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>URL Slug</span>
              <input className={styles.input} value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="Auto-generated from name if left blank" maxLength={80} />
              <span className={styles.hint}>/divisions/{form.slug || '…'}</span>
            </label>
          </>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Division</span>
            <span className={styles.hint}>{form.name} — /divisions/{form.slug} (only exec/admin can rename or re-slug a division)</span>
          </div>
        )}

        <ImageUploadField
          label="Logo"
          value={form.logo_url}
          onChange={(v) => set('logo_url', v)}
          bucket="division-logos"
          shape="logo"
          maxDimension={512}
        />

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

        <SocialLinksField
          value={form.social_links}
          onChange={(v) => set('social_links', v)}
          exclude={['discord']}
          hint="Just your handle, not the full link — optional."
        />

        <PageBlocksEditor blocks={form.page_blocks} onChange={(b) => set('page_blocks', b)} bucket="site-content" />

        <SocialEmbedsField
          value={form.social_embeds}
          onChange={(v) => set('social_embeds', v)}
          hint="Shown on this division's own page. Instagram, X, TikTok, and YouTube embed live; Discord links show as a card."
        />

        {error && <Notice tone="error">{error}</Notice>}

        <div className={styles.actions}>
          <Link href={backHref} className={styles.cancelBtn}>Cancel</Link>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
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
