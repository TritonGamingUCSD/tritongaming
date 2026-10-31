'use client';

import Loading from '@/components/Loading/Loading';
import { useState } from 'react';
import { Check, Moon } from 'lucide-react';
import { Input } from '@/components/ui/Field';
import { AUDIENCE_LABELS } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import { Avatar } from './Avatar';
import { TeamPerson } from './types';

// Pick people from the team: search, "add everyone who is …" shortcuts, and a tick list. People in
// `covered` are already included another way (a ticked role or group): shown ticked and locked.
export function PeoplePicker({ team, value, onChange, covered }: { team: TeamPerson[] | null; value: string[]; onChange: (ids: string[]) => void; covered?: Map<string, string> }) {
  const [query, setQuery] = useState('');
  const shown = (team ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const addRole = (role: string) =>
    onChange([...new Set([...value, ...(team ?? []).filter((p) => p.roles.includes(role) && !p.inactive && !covered?.has(p.id)).map((p) => p.id)])]);
  return (
    <div className={styles.picker}>
      <div className={styles.pickTop}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" aria-label="Search people" />
        <span className={styles.pickCount}>
          <strong>{value.length}</strong> added
        </span>
      </div>
      <div className={styles.presets}>
        <span className={styles.faint}>Add everyone who is</span>
        {(['exec', 'lead', 'officer', 'recruit'] as const).map((r) => (
          <button key={r} type="button" className={styles.chip} onClick={() => addRole(r)} disabled={!team}>
            {AUDIENCE_LABELS[r]}
          </button>
        ))}
        {value.length > 0 && (
          <button type="button" className={styles.chip} onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
      {!team ? (
        <Loading variant="inline" label="Loading people…" />
      ) : (
        <ul className={styles.pickList}>
          {shown.map((p) => {
            const via = covered?.get(p.id);
            const on = !!via || value.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`${styles.pickRow} ${on ? styles.pickRowOn : ''} ${via ? styles.pickRowLocked : ''} ${p.inactive ? styles.pickRowIdle : ''}`}>
                  <input type="checkbox" className={styles.checkInput} checked={on} disabled={!!via} onChange={() => toggle(p.id)} />
                  <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ''}`} aria-hidden="true">
                    {on && <Check size={13} strokeWidth={3} />}
                  </span>
                  <Avatar p={p} />
                  <span className={styles.personName}>{p.name}</span>
                  {p.inactive && (
                    <span
                      className={styles.idleTag}
                      title={
                        p.alumni
                          ? 'Alumni: role-based meetings skip them, but they can be added by name'
                          : 'Inactive this quarter: role-based and team meetings skip them, but they can be added by name'
                      }
                    >
                      <Moon size={11} aria-hidden="true" /> {p.alumni ? 'Alumni' : 'Inactive now'}
                    </span>
                  )}
                  <span className={styles.pickRole}>{via ? `via ${via}` : p.role}</span>
                </label>
              </li>
            );
          })}
          {shown.length === 0 && <li className={styles.faint}>No one matches.</li>}
        </ul>
      )}
    </div>
  );
}
