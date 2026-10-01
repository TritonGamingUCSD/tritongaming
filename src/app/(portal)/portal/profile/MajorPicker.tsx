'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { MAJOR_OPTIONS, MAJOR_SEPARATOR, MAX_MAJORS, splitStoredMajors } from '@/lib/majors';
import styles from './profile.module.css';

const OTHER = '__other__';

// Pick up to three majors from a list (so "CS" / "comp sci" / "Computer Science"
// all end up as one name and analytics can group them), with "Other" for
// anything not listed. Stored as one string: "Computer Science / Mathematics".
export default function MajorPicker({ value, onChange, required }: { value: string; onChange: (v: string) => void; required?: boolean }) {
  const chosen = splitStoredMajors(value);
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState('');
  const full = chosen.length >= MAX_MAJORS;

  function set(list: string[]) { onChange(list.join(MAJOR_SEPARATOR)); }
  function add(name: string) {
    const n = name.trim().slice(0, 60);
    if (!n || full || chosen.some((c) => c.toLowerCase() === n.toLowerCase())) return;
    set([...chosen, n]);
  }

  return (
    <div className={styles.majorPicker}>
      {chosen.length > 0 && (
        <div className={styles.majorChips}>
          {chosen.map((m) => (
            <span key={m} className={styles.majorChip}>
              {m}
              <button type="button" className={styles.majorChipX} onClick={() => set(chosen.filter((c) => c !== m))} aria-label={`Remove ${m}`}>
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {!full && !other && (
        <select
          className={styles.input}
          value=""
          required={required && chosen.length === 0}
          onChange={(e) => {
            if (e.target.value === OTHER) setOther(true);
            else add(e.target.value);
          }}
        >
          <option value="">{chosen.length ? 'Add another major (double major?)' : 'Select your major'}</option>
          {MAJOR_OPTIONS.filter((o) => !chosen.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other (type it in)…</option>
        </select>
      )}
      {!full && other && (
        <div className={styles.majorOther}>
          <input
            className={styles.input}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(otherText); setOtherText(''); setOther(false); } }}
            maxLength={60}
            placeholder="Type your major"
            autoFocus
          />
          <button type="button" className={styles.majorAddBtn} onClick={() => { add(otherText); setOtherText(''); setOther(false); }} disabled={!otherText.trim()}>Add</button>
          <button type="button" className={styles.majorCancelBtn} onClick={() => { setOther(false); setOtherText(''); }}>Cancel</button>
        </div>
      )}
      <span className={styles.charCount} style={{ textAlign: 'left' }}>
        {full ? `Up to ${MAX_MAJORS} majors.` : 'Double majoring? Add each one.'}
      </span>
    </div>
  );
}
