'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { AppRole } from '@/types/database';
import styles from './new/newevent.module.css';

export const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year+', 'Graduate', 'Alumni'];
export const ROLE_OPTIONS: AppRole[] = ['exec', 'lead', 'officer', 'division', 'alumni', 'recruit', 'admin', 'ucsd'];

type MappingRow = { value?: string; label?: string };

export interface CheckinFormConfigValue {
  form_url: string;
  entry_event_name: string;
  entry_academic_year: string;
  entry_affiliation: string;
  entry_food_item: string;
  year_mapping: MappingRow[];
  affiliation_mapping: MappingRow[];
}

export const EMPTY_CHECKIN_FORM_CONFIG: CheckinFormConfigValue = {
  form_url: '', entry_event_name: '', entry_academic_year: '', entry_affiliation: '', entry_food_item: '',
  year_mapping: [], affiliation_mapping: [],
};

interface DetectedQuestion { title: string; entryId: string; options: string[] | null; }

type AssignableField = 'entry_event_name' | 'entry_academic_year' | 'entry_affiliation' | 'entry_food_item';
const ASSIGNABLE_FIELDS: { key: AssignableField; label: string }[] = [
  { key: 'entry_event_name', label: 'Event Name' },
  { key: 'entry_academic_year', label: 'Academic Year' },
  { key: 'entry_affiliation', label: 'Affiliation' },
  { key: 'entry_food_item', label: 'Food/Item Received' },
];

// Guesses which of our 4 fields a detected question is, from its title —
// UCSD's own wording is fairly predictable ("What is your academic
// year?", "affiliation with the hosting organization(s)", "food or items
// received"), so this saves picking all 4 by hand; anything guessed wrong
// is still just one dropdown click to fix. Deliberately narrow/combined
// checks (not just "event") so "How did you hear about this event?" never
// gets mistaken for the event-name question — that one's meant to always
// stay unassigned.
function guessAssignment(title: string): AssignableField | null {
  const t = title.toLowerCase();
  if (t.includes('academic year')) return 'entry_academic_year';
  if (t.includes('affiliation')) return 'entry_affiliation';
  if (t.includes('food') || t.includes('item')) return 'entry_food_item';
  if (t.includes('event') && (t.includes('sign') || t.includes('attend') || t.includes('checking'))) return 'entry_event_name';
  return null;
}

// One reusable {ourValue, formOptionText} lookup-table editor for both
// mapping fields below — order doesn't mean anything here (it's a lookup,
// not a display list), so unlike the drag-reorderable lists elsewhere in
// the portal, this is just a plain add/remove list.
//
// `keyOptions`, when given, turns the left column into a <select> instead
// of free text — both Year and Role are fixed, closed sets baked into the
// code (ProfileClient's year dropdown, the AppRole type), not something
// that changes based on anything an admin does in the portal, so there's a
// real fixed list to pick from rather than retyping a value that has to
// match exactly or the mapping silently does nothing.
function MappingField({
  label, hint, keyOptions, keyPlaceholder, valuePlaceholder, rows, onChange, staleRows,
}: {
  label: string;
  hint: string;
  keyOptions?: string[];
  keyPlaceholder: string;
  valuePlaceholder: string;
  rows: MappingRow[];
  onChange: (rows: MappingRow[]) => void;
  // Per-row "this option text isn't on the live form anymore" flag — see
  // CheckinFormFieldsEditor's stale-check after Detect.
  staleRows?: boolean[];
}) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={styles.mappingList}>
        {rows.map((row, i) => (
          <div key={i}>
            <div className={styles.mappingRow}>
              {keyOptions ? (
                <select
                  className={styles.input}
                  value={row.value ?? ''}
                  onChange={(e) => { const n = [...rows]; n[i] = { ...n[i], value: e.target.value }; onChange(n); }}
                >
                  <option value="" disabled>{keyPlaceholder}</option>
                  {keyOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  className={styles.input}
                  value={row.value ?? ''}
                  placeholder={keyPlaceholder}
                  onChange={(e) => { const n = [...rows]; n[i] = { ...n[i], value: e.target.value }; onChange(n); }}
                />
              )}
              <input
                className={styles.input}
                value={row.label ?? ''}
                placeholder={valuePlaceholder}
                onChange={(e) => { const n = [...rows]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }}
              />
              <button type="button" className={styles.mappingRemoveBtn} onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
            {staleRows?.[i] && (
              <p className={styles.staleWarning}>⚠ &quot;{row.label}&quot; doesn&apos;t match a current option on the form — that question will just show up blank instead of pre-filled.</p>
            )}
          </div>
        ))}
        <button type="button" className={styles.mappingAddBtn} onClick={() => onChange([...rows, { value: '', label: '' }])}>+ Add Mapping</button>
      </div>
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}

// The shared "configure a Google Form" editor — used both for the one
// site-wide default (CheckinFormSettingsPanel) and a rare per-event
// override (EventForm), since both are exactly the same shape underneath.
// The "Detect Questions" button is the whole point of this component: it
// reads the form's own public page (see /api/admin/checkin-form/detect)
// and lists every question with a plain assignment dropdown, so nobody
// managing the portal ever has to know what an "entry ID" is or go
// through Google's own "Get pre-filled link" flow by hand.
export default function CheckinFormFieldsEditor({ value, onChange }: {
  value: CheckinFormConfigValue;
  onChange: (value: CheckinFormConfigValue) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [questions, setQuestions] = useState<DetectedQuestion[] | null>(null);
  // Which currently-configured entry IDs/mapping rows no longer match
  // anything on the live form — computed fresh each time Detect runs, so
  // if UCSD ever changes the form (new question, reworded options, a
  // question deleted and recreated with a new ID), whatever's now stale
  // gets flagged instead of silently failing to prefill with no warning.
  // There's no way to check this automatically at prefill time itself
  // (that would mean fetching the live form on every ticket page load,
  // which fights the whole "keep check-in fast" goal) — this is the
  // deliberate manual substitute: re-run Detect after a form change and
  // see what it flags.
  const [stale, setStale] = useState<{
    fields: Partial<Record<AssignableField, boolean>>;
    yearRows: boolean[];
    affiliationRows: boolean[];
  } | null>(null);

  function set<K extends keyof CheckinFormConfigValue>(field: K, v: CheckinFormConfigValue[K]) {
    onChange({ ...value, [field]: v });
  }

  async function handleDetect() {
    if (!value.form_url.trim()) return;
    setDetecting(true);
    setDetectError('');
    setQuestions(null);
    try {
      const res = await fetch('/api/admin/checkin-form/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_url: value.form_url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to read that form.');
      const detected = data.questions as DetectedQuestion[];
      setQuestions(detected);
      const byEntryId = new Map(detected.map((q) => [q.entryId, q]));

      // Auto-guess assignments by keyword — only for fields that aren't
      // already set, so re-running Detect after manual edits never
      // clobbers a deliberate choice (including one that disagrees with
      // the guess).
      let next = value;
      for (const q of detected) {
        const guess = guessAssignment(q.title);
        if (!guess || next[guess]) continue;
        next = { ...next, [guess]: q.entryId };
        if (guess === 'entry_academic_year' && q.options && next.year_mapping.length === 0) {
          next = { ...next, year_mapping: q.options.map((opt) => ({ value: '', label: opt })) };
        }
        if (guess === 'entry_affiliation' && q.options && next.affiliation_mapping.length === 0) {
          next = { ...next, affiliation_mapping: q.options.map((opt) => ({ value: '', label: opt })) };
        }
      }
      if (next !== value) onChange(next);

      // Flag anything already configured that no longer matches the live
      // form — a previously-saved entry ID with no corresponding question
      // anymore, or a mapping row whose form-option text isn't among that
      // question's current choices.
      const fields: Partial<Record<AssignableField, boolean>> = {};
      ASSIGNABLE_FIELDS.forEach(({ key }) => {
        if (next[key]) fields[key] = !byEntryId.has(next[key]);
      });
      const yearQuestion = next.entry_academic_year ? byEntryId.get(next.entry_academic_year) : undefined;
      const yearRows = next.year_mapping.map((row) =>
        !!row.label && !!yearQuestion?.options && !yearQuestion.options.includes(row.label)
      );
      const affiliationQuestion = next.entry_affiliation ? byEntryId.get(next.entry_affiliation) : undefined;
      const affiliationRows = next.affiliation_mapping.map((row) =>
        !!row.label && !!affiliationQuestion?.options && !affiliationQuestion.options.includes(row.label)
      );
      setStale({ fields, yearRows, affiliationRows });
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Failed to read that form.');
    } finally {
      setDetecting(false);
    }
  }

  // Assigning a choice question to Year/Affiliation also seeds the mapping
  // table with the form's own option text on the right side — all that's
  // left is picking which of *our* values matches each one from the
  // dropdown already built into MappingField's left column.
  function assign(q: DetectedQuestion, field: AssignableField) {
    const next: CheckinFormConfigValue = { ...value, [field]: q.entryId };
    if (field === 'entry_academic_year' && q.options) {
      next.year_mapping = q.options.map((opt) => ({ value: '', label: opt }));
    }
    if (field === 'entry_affiliation' && q.options) {
      next.affiliation_mapping = q.options.map((opt) => ({ value: '', label: opt }));
    }
    onChange(next);
  }

  function unassign(entryId: string) {
    const next = { ...value };
    ASSIGNABLE_FIELDS.forEach(({ key }) => { if (next[key] === entryId) next[key] = ''; });
    onChange(next);
  }

  return (
    <>
      <label className={styles.field}>
        <span className={styles.label}>Google Form URL</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className={styles.input}
            type="url"
            value={value.form_url}
            onChange={(e) => set('form_url', e.target.value)}
            placeholder="https://docs.google.com/forms/d/e/…/viewform"
          />
          <button
            type="button"
            className={styles.previewBtn}
            style={{ flexShrink: 0 }}
            onClick={handleDetect}
            disabled={detecting || !value.form_url.trim()}
          >
            {detecting ? 'Reading…' : 'Detect Questions'}
          </button>
        </div>
        <span className={styles.hint}>Paste the form link and click Detect — no need to find entry IDs yourself.</span>
      </label>

      {detectError && <p className={styles.error}>{detectError}</p>}

      {questions && (
        <div className={styles.field}>
          <span className={styles.label}>Detected Questions</span>
          <div className={styles.mappingList}>
            {questions.map((q) => {
              const assignedField = ASSIGNABLE_FIELDS.find(({ key }) => value[key] === q.entryId)?.key ?? '';
              return (
                <div key={q.entryId} className={styles.detectedRow}>
                  <div className={styles.detectedInfo}>
                    <div className={styles.detectedTitle}>{q.title}</div>
                    {q.options && <div className={styles.detectedOptions}>{q.options.join(' · ')}</div>}
                  </div>
                  <select
                    className={styles.input}
                    value={assignedField}
                    onChange={(e) => {
                      const f = e.target.value as AssignableField | '';
                      if (!f) unassign(q.entryId);
                      else assign(q, f);
                    }}
                  >
                    <option value="">Don&apos;t use</option>
                    {ASSIGNABLE_FIELDS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <span className={styles.hint}>
            Assigning Academic Year or Affiliation auto-fills that option list below — just pick which of our own
            values matches each one.
          </span>
        </div>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Entry ID — Event Name</span>
          <input className={styles.input} value={value.entry_event_name} onChange={(e) => set('entry_event_name', e.target.value)} />
          {stale?.fields.entry_event_name && <p className={styles.staleWarning}>⚠ Not found on the form anymore — re-detect to fix.</p>}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Entry ID — Food/Item Received</span>
          <input className={styles.input} value={value.entry_food_item} onChange={(e) => set('entry_food_item', e.target.value)} />
          {stale?.fields.entry_food_item && <p className={styles.staleWarning}>⚠ Not found on the form anymore — re-detect to fix.</p>}
        </label>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Entry ID — Academic Year</span>
          <input className={styles.input} value={value.entry_academic_year} onChange={(e) => set('entry_academic_year', e.target.value)} />
          {stale?.fields.entry_academic_year && <p className={styles.staleWarning}>⚠ Not found on the form anymore — re-detect to fix.</p>}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Entry ID — Affiliation with Triton Gaming</span>
          <input className={styles.input} value={value.entry_affiliation} onChange={(e) => set('entry_affiliation', e.target.value)} />
          {stale?.fields.entry_affiliation && <p className={styles.staleWarning}>⚠ Not found on the form anymore — re-detect to fix.</p>}
        </label>
      </div>
      <span className={styles.hint} style={{ marginTop: '-0.75rem' }}>
        These fill in automatically once you assign a detected question above — only edit them directly if you
        already know the entry ID (e.g. from Google's own &quot;Get pre-filled link&quot;). Click Detect Questions
        again any time to check these are still valid — useful after UCSD changes the form.
      </span>

      <MappingField
        label="Academic Year → Form Option Text"
        hint="Our profile's Year value on the left (a fixed list — this doesn't change), the form's exact multiple-choice option text on the right. A year with no row here is just left blank on the form."
        keyOptions={YEAR_OPTIONS}
        keyPlaceholder="Select a year…"
        valuePlaceholder="Form's exact option text"
        rows={value.year_mapping}
        onChange={(rows) => set('year_mapping', rows)}
        staleRows={stale?.yearRows}
      />

      <MappingField
        label="Role → Form Option Text"
        hint="Our internal role name on the left (a fixed list — this doesn't change), the form's exact option text on the right."
        keyOptions={ROLE_OPTIONS}
        keyPlaceholder="Select a role…"
        valuePlaceholder="Form's exact option text"
        rows={value.affiliation_mapping}
        onChange={(rows) => set('affiliation_mapping', rows)}
        staleRows={stale?.affiliationRows}
      />
    </>
  );
}
