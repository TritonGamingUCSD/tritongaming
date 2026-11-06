'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { ROLE_LABELS } from '@/types/database';
import { describeEntries, type AccessEntry } from '@/lib/docs/access';
import styles from './docAccess.module.css';

type Kind = 'division-head' | 'division-member' | 'division-alumni' | 'signed_in' | 'everyone' | 'role' | 'team' | 'person' | 'any-head' | 'any-member';
const CLUB_ROLES = ['recruit', 'officer', 'lead', 'exec', 'alumni', 'ucsd'] as const;

// One of the two lists of a doc (who can read, who can edit), as chips you can remove plus a small "add" row. Presets on top set the common cases in one click. A Member cannot open a doc to everyone; nobody can open editing to everyone.
export default function DocAccessEditor({
  label,
  hint,
  value,
  onChange,
  divisionId,
  divisionName,
  teams,
  canSearchPeople,
  wide,
  presets,
}: {
  label: string;
  hint?: string;
  value: AccessEntry[];
  onChange: (v: AccessEntry[]) => void;
  divisionId: string;
  divisionName: string;
  teams: { id: string; name: string }[];
  canSearchPeople: boolean;
  wide: 'read' | 'none';
  presets: { label: string; entries: AccessEntry[] }[];
}) {
  const [kind, setKind] = useState<Kind>('division-member');
  const [role, setRole] = useState<string>('officer');
  const [teamId, setTeamId] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (kind !== 'person' || query.trim().length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/divisions/${divisionId}/roster?search=${encodeURIComponent(query.trim())}`, { cache: 'no-store' }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => ({})) : {};
      setFound((j.matches as { id: string; name: string }[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, kind, divisionId]);
  const has = (e: AccessEntry) =>
    value.some((x) => JSON.stringify(x.t === 'person' ? { t: 'person', id: x.id } : x) === JSON.stringify(e.t === 'person' ? { t: 'person', id: e.id } : e));
  const add = (e: AccessEntry) => {
    if (!has(e)) onChange([...value, e]);
  };
  const names = { team: (id: string) => teams.find((t) => t.id === id)?.name ?? 'A team', roleLabel: (r: string) => (ROLE_LABELS as Record<string, string>)[r] ?? r };
  const chip = (e: AccessEntry) =>
    describeEntries([e], names, divisionId)
      .replace(/^Heads of this division$/, `Heads of ${divisionName}`)
      .replace(/^Members of this division$/, `Members of ${divisionName}`)
      .replace(/^Alumni of this division$/, `Alumni of ${divisionName}`);
  const addSelected = () => {
    if (kind === 'division-head') add({ t: 'division', role: 'division', division_id: divisionId });
    else if (kind === 'division-member') add({ t: 'division', role: 'division_member', division_id: divisionId });
    else if (kind === 'division-alumni') add({ t: 'division', role: 'division_alumni', division_id: divisionId });
    else if (kind === 'any-head') add({ t: 'division', role: 'division', division_id: null });
    else if (kind === 'any-member') add({ t: 'division', role: 'division_member', division_id: null });
    else if (kind === 'signed_in') add({ t: 'signed_in' });
    else if (kind === 'everyone') add({ t: 'everyone' });
    else if (kind === 'role') add({ t: 'role', role });
    else if (kind === 'team' && teamId) add({ t: 'team', id: teamId });
  };
  const needsPick = kind === 'person' || kind === 'team' || kind === 'role';
  return (
    <fieldset className={styles.box}>
      <legend>{label}</legend>
      {hint && <p className={styles.hint}>{hint}</p>}
      <div className={styles.presets} role="group" aria-label={`${label}: quick choices`}>
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className={`${styles.preset} ${JSON.stringify(p.entries) === JSON.stringify(value) ? styles.presetOn : ''}`}
            onClick={() => onChange(p.entries)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ul className={styles.chips}>
        {value.length === 0 && <li className={styles.none}>Nobody yet (exec and admin can always get in).</li>}
        {value.map((e, i) => (
          <li key={i} className={styles.chip}>
            {chip(e)}
            <button type="button" aria-label={`Remove ${chip(e)}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.add}>
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)} aria-label={`${label}: add who`}>
          <optgroup label={divisionName}>
            <option value="division-head">Heads</option>
            <option value="division-member">Members</option>
            <option value="division-alumni">Alumni</option>
          </optgroup>
          <optgroup label="Others">
            <option value="role">Everyone with a role…</option>
            <option value="team">A team…</option>
            {canSearchPeople && <option value="person">A person…</option>}
            <option value="any-head">Heads of any division</option>
            <option value="any-member">Members of any division</option>
            <option value="signed_in">Everyone signed in</option>
            {wide === 'read' && <option value="everyone">Everyone (public)</option>}
          </optgroup>
        </Select>
        {kind === 'role' && (
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
            {CLUB_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        )}
        {kind === 'team' && (
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team">
            <option value="">{teams.length ? 'Pick a team' : 'No teams yet'}</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        {kind === 'person' ? (
          <div className={styles.person}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…" aria-label="Search people" />
            {found.length > 0 && (
              <ul className={styles.results}>
                {found.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        add({ t: 'person', id: p.id, name: p.name });
                        setQuery('');
                        setFound([]);
                      }}
                    >
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <button type="button" className={styles.addBtn} disabled={needsPick && kind === 'team' && !teamId} onClick={addSelected}>
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        )}
      </div>
    </fieldset>
  );
}
