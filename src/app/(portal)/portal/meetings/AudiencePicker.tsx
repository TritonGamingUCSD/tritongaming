'use client';

import Loading from '@/components/Loading/Loading';
import { useState } from 'react';
import { AUDIENCE_LABELS, AUDIENCE_ROLES } from '@/lib/meetings/meetingAudience';
import styles from './meetings.module.css';
import { Aud, audienceEmpty } from './audience';
import { CheckTile } from './CheckTile';
import { useGroups, useTeam } from './hooks';
import { PeoplePicker } from './PeoplePicker';

export function AudiencePicker({ value, onChange, hideOpen, hideTeams }: { value: Aud; onChange: (v: Aud) => void; hideOpen?: boolean; hideTeams?: boolean }) {
  const team = useTeam();
  const [groups] = useGroups();
  const [showPeople, setShowPeople] = useState(value.invitees.length > 0);
  const all = value.roles.length === AUDIENCE_ROLES.length;
  const toggleRole = (r: string) => onChange({ ...value, roles: value.roles.includes(r) ? value.roles.filter((x) => x !== r) : [...value.roles, r] });
  const toggleGroup = (id: string) => onChange({ ...value, groups: value.groups.includes(id) ? value.groups.filter((x) => x !== id) : [...value.groups, id] });
  // Who is already included by a ticked role or group (so the people list can show them locked).
  const covered = new Map<string, string>();
  for (const p of team ?? []) {
    const g = (groups ?? []).find((x) => value.groups.includes(x.id) && x.member_ids.includes(p.id));
    if (!p.inactive && p.roles.some((r) => value.roles.includes(r))) covered.set(p.id, 'role');
    else if (g && !p.inactive) covered.set(p.id, g.name);
  }
  return (
    <div className={styles.audience}>
      <div className={styles.audSection}>
        <span className={styles.audTitle}>
          Roles <em>everyone with the role, always up to date</em>
        </span>
        <div className={styles.checkGrid} role="group" aria-label="Roles">
          <CheckTile
            label="Select all"
            checked={all}
            indeterminate={!all && value.roles.length > 0}
            onChange={() => onChange({ ...value, roles: all ? [] : [...AUDIENCE_ROLES] })}
          />
          {AUDIENCE_ROLES.map((r) => (
            <CheckTile key={r} label={AUDIENCE_LABELS[r]} checked={value.roles.includes(r)} onChange={() => toggleRole(r)} />
          ))}
        </div>
      </div>

      {!hideTeams && (
        <div className={styles.audSection}>
          <span className={styles.audTitle}>
            Teams <em>pick more than one; changes to a team carry over</em>
          </span>
          {groups && groups.length > 0 ? (
            <div className={styles.presets}>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={value.groups.includes(g.id)}
                  className={`${styles.chip} ${value.groups.includes(g.id) ? styles.chipOn : ''}`}
                  onClick={() => toggleGroup(g.id)}
                >
                  {g.name} · {g.member_ids.length}
                </button>
              ))}
            </div>
          ) : groups ? (
            <p className={styles.faint}>No teams yet. Make one under TG Members › Team.</p>
          ) : (
            <Loading variant="inline" label="Loading teams…" />
          )}
        </div>
      )}

      <div className={styles.audSection}>
        <button type="button" className={styles.audToggle} onClick={() => setShowPeople((v) => !v)} aria-expanded={showPeople}>
          <span className={styles.audTitle}>
            Add individual people <em>{value.invitees.length > 0 ? `${value.invitees.length} added` : 'optional'}</em>
          </span>
          <span className={styles.faint}>{showPeople ? 'Hide' : 'Show'}</span>
        </button>
        {showPeople && <PeoplePicker team={team} value={value.invitees} onChange={(ids) => onChange({ ...value, invitees: ids })} covered={covered} />}
      </div>

      {!hideOpen && (
        <label className={styles.openRow}>
          <input type="checkbox" checked={value.open} onChange={(e) => onChange({ ...value, open: e.target.checked })} />
          <span>
            Let other officers and recruits check in too <em>They count as +1 on the live screen and the report. Turn this off to keep the meeting to the people above.</em>
          </span>
        </label>
      )}

      {audienceEmpty(value) ? <p className={styles.checkWarn}>Pick at least one role, group or person.</p> : null}
    </div>
  );
}
