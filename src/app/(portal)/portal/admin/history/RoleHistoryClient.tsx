'use client';

import SectionHeader from '@/components/ui/SectionHeader';
import { useState } from 'react';
import { roleInk } from '@/lib/roleColors';
import { History, ChevronDown } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '@/types/database';
import type { AppRole } from '@/types/database';
import { PACIFIC_TZ, formatPacificDateTime } from '@/lib/timezone';
import type { RoleChangeEntry } from './getRoleHistoryData';
import styles from './rolehistory.module.css';

type Grant = { role: AppRole; division_id: string | null };

function grantKey(g: Grant) {
  return `${g.role}-${g.division_id ?? ''}`;
}

function diff(before: Grant[], after: Grant[]) {
  const beforeKeys = new Set(before.map(grantKey));
  const afterKeys = new Set(after.map(grantKey));
  return {
    added: after.filter((g) => !beforeKeys.has(grantKey(g))),
    removed: before.filter((g) => !afterKeys.has(grantKey(g))),
  };
}

function RoleChip({ grant, divisionNameById }: { grant: Grant; divisionNameById: Map<string, string> }) {
  const label = grant.role === 'division' && grant.division_id
    ? `${ROLE_LABELS.division} — ${divisionNameById.get(grant.division_id) ?? 'Unknown'}`
    : ROLE_LABELS[grant.role];
  return (
    <span className={styles.chip} style={{ background: ROLE_COLORS[grant.role] + '18', color: roleInk(ROLE_COLORS[grant.role]), borderColor: ROLE_COLORS[grant.role] + '44' }}>
      {label}
    </span>
  );
}

export default function RoleHistoryClient({ entries, divisions }: { entries: RoleChangeEntry[]; divisions: { id: string; name: string }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const divisionNameById = new Map(divisions.map((d) => [d.id, d.name]));

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}><History size={40} strokeWidth={1.25} aria-hidden="true" /></span>
        <h2 className={styles.emptyTitle}>No role changes yet</h2>
        <p className={styles.emptySub}>Every save made in the Role Manager will show up here.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SectionHeader title="Role History" sub="Who changed whose roles, and when." />
      <ul className={styles.list}>
        {entries.map((entry) => {
          const { added, removed } = diff(entry.before, entry.after);
          const isOpen = openId === entry.id;
          return (
            <li key={entry.id} className={styles.item}>
              <button className={styles.itemHeader} onClick={() => setOpenId(isOpen ? null : entry.id)}>
                <div className={styles.itemSummary}>
                  <span className={styles.itemUser}>{entry.user?.display_name || 'Unknown user'}</span>
                  <span className={styles.itemMuted}>
                    {added.length > 0 && `+${added.length}`}
                    {added.length > 0 && removed.length > 0 && ' / '}
                    {removed.length > 0 && `-${removed.length}`}
                    {added.length === 0 && removed.length === 0 && 'no change'}
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  <span>by {entry.changed_by?.display_name || 'Unknown'}</span>
                  <span>
                    {formatPacificDateTime(entry.created_at)}
                  </span>
                  <ChevronDown size={16} strokeWidth={1.75} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} aria-hidden="true" />
                </div>
              </button>
              {isOpen && (
                <div className={styles.itemDetail}>
                  <div className={styles.diffCol}>
                    <span className={styles.diffLabel}>Before</span>
                    <div className={styles.chipRow}>
                      {entry.before.length === 0 ? <span className={styles.itemMuted}>No roles</span> : entry.before.map((g) => <RoleChip key={grantKey(g)} grant={g} divisionNameById={divisionNameById} />)}
                    </div>
                  </div>
                  <div className={styles.diffCol}>
                    <span className={styles.diffLabel}>After</span>
                    <div className={styles.chipRow}>
                      {entry.after.length === 0 ? <span className={styles.itemMuted}>No roles</span> : entry.after.map((g) => <RoleChip key={grantKey(g)} grant={g} divisionNameById={divisionNameById} />)}
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
