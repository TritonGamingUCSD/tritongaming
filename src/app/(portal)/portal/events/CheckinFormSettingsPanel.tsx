'use client';

import { useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { buildCheckinFormUrl } from '@/lib/checkinForm';
import type { AppRole } from '@/types/database';
import CheckinFormFieldsEditor, { YEAR_OPTIONS, ROLE_OPTIONS, type CheckinFormConfigValue } from './CheckinFormFieldsEditor';
import styles from './new/newevent.module.css';

export type CheckinFormSettings = CheckinFormConfigValue;

export default function CheckinFormSettingsPanel({ initial }: { initial: CheckinFormSettings }) {
  const [form, setForm] = useState<CheckinFormConfigValue>({
    form_url: initial.form_url ?? '',
    entry_event_name: initial.entry_event_name ?? '',
    entry_academic_year: initial.entry_academic_year ?? '',
    entry_affiliation: initial.entry_affiliation ?? '',
    entry_food_item: initial.entry_food_item ?? '',
    year_mapping: initial.year_mapping ?? [],
    affiliation_mapping: initial.affiliation_mapping ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [preview, setPreview] = useState({
    eventTitle: 'Test Event',
    year: YEAR_OPTIONS[0] as string,
    role: ROLE_OPTIONS[0] as AppRole,
    foodItem: 'Pizza',
  });

  // Uses the current *unsaved* form state, not what's stored in the DB —
  // so an admin can check their edits actually work before hitting Save.
  // Opens the real Google Form with these test values filled in; nothing
  // gets recorded unless someone actually clicks that form's own Submit,
  // which this deliberately never does on its own.
  const previewUrl = buildCheckinFormUrl(form, {
    eventTitle: preview.eventTitle,
    year: preview.year,
    roles: [preview.role],
    foodItem: preview.foodItem,
  });

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/checkin-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.form} style={{ maxWidth: 640 }}>
      <p className={styles.hint} style={{ marginBottom: '0.5rem' }}>
        The default Google Form for every event with &quot;Requires AS Form&quot; turned on — a rare event that
        needs a completely different form can override this from its own editor instead.
      </p>

      <CheckinFormFieldsEditor value={form} onChange={setForm} />

      <div className={styles.sectionDivider}>
        <span className={styles.sectionLabel}>Test It</span>
        <span className={styles.hint}>
          Opens the real form with these test values filled in, so you can check the mappings actually work —
          without submitting anything. It only ever submits if you click that form&apos;s own Submit button yourself,
          which this doesn&apos;t do for you. Uses whatever&apos;s in the fields above right now, even if you haven&apos;t saved yet.
        </span>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Test Event Name</span>
          <input className={styles.input} value={preview.eventTitle} onChange={(e) => setPreview((p) => ({ ...p, eventTitle: e.target.value }))} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Test Food/Item</span>
          <input className={styles.input} value={preview.foodItem} onChange={(e) => setPreview((p) => ({ ...p, foodItem: e.target.value }))} />
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Test Academic Year</span>
          <select className={styles.input} value={preview.year} onChange={(e) => setPreview((p) => ({ ...p, year: e.target.value }))}>
            {YEAR_OPTIONS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Test Role</span>
          <select className={styles.input} value={preview.role} onChange={(e) => setPreview((p) => ({ ...p, role: e.target.value as AppRole }))}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>

      {previewUrl ? (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={styles.previewBtn}>
          <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" /> Preview AS Form
        </a>
      ) : (
        <span className={styles.hint}>Enter a Google Form URL above to enable the preview.</span>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions} style={{ justifyContent: 'flex-start' }}>
        <button type="button" className={styles.submitBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saved ? <><Check size={15} strokeWidth={2} aria-hidden="true" /> Saved</> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
