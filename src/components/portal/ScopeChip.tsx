'use client';

import { useMemo, useState } from 'react';
import { Building2, Info } from 'lucide-react';
import { useDivisionDirectory } from './DivisionDirectory';
import { useLiveParams, usePortalParams } from '@/lib/portal/usePortalParams';
import styles from './scope.module.css';

/** Whose an item is: "Club" or the division's name in its colour. Under it a title says who can see it. */
export function ScopeChip({ divisionId, shared = [] }: { divisionId: string | null | undefined; shared?: (string | null)[] }) {
  const dir = useDivisionDirectory();
  const d = divisionId ? dir.find((x) => x.id === divisionId) : null;
  const others = shared.map((id) => (id ? dir.find((x) => x.id === id)?.name : 'Club')).filter(Boolean) as string[];
  return (
    <span className={styles.chips}>
      {d ? (
        <span className={styles.chip} style={{ ['--dot' as string]: d.accent }} title={`${d.name}’s. Only its Heads and Members, and exec and admin, see it.`}>
          <i className={styles.dot} aria-hidden="true" />
          {d.name}
        </span>
      ) : (
        <span className={`${styles.chip} ${styles.club}`} title="Triton Gaming’s own. Officers and above, and exec and admin, see it.">
          <Building2 size={11} aria-hidden="true" /> Club
        </span>
      )}
      {others.length > 0 && (
        <span className={`${styles.chip} ${styles.shared}`} title={`Shared with ${others.join(', ')}`}>
          + {others.join(', ')}
        </span>
      )}
    </span>
  );
}

/** A line under a page title saying whose items the page lists. */
export function ScopeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.note}>
      <Info size={14} aria-hidden="true" /> {children}
    </p>
  );
}

/** "Who can see this" while making or editing something: whose it is and what each group can do. */
export function WhoCanSee({ owner, lines }: { owner: string; lines: string[] }) {
  return (
    <aside className={styles.who} aria-label="Who can see this">
      <b>
        Who Can See This <span>{owner}</span>
      </b>
      <ul>
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * A filter for a list that mixes owners: All, Club, and one button per division that appears. It shows only when there is more than one owner. The pick is in the address (?scope=club or a division's address).
 * `divisionOf` is how to read an item's owner.
 */
export function useScopeFilter<T>(items: T[] | null | undefined, divisionOf: (t: T) => string | null | undefined) {
  const dir = useDivisionDirectory();
  const params = useLiveParams();
  const setParams = usePortalParams();
  const [local, setLocal] = useState<string | null>(params.get('scope'));
  const present = useMemo(() => {
    const ids = new Set<string>();
    let club = false;
    for (const it of items ?? []) {
      const d = divisionOf(it);
      if (d) ids.add(d);
      else club = true;
    }
    return { club, divisions: dir.filter((x) => ids.has(x.id)) };
  }, [items, dir, divisionOf]);
  const owners = (present.club ? 1 : 0) + present.divisions.length;
  const pick = local && (local === 'club' || present.divisions.some((x) => x.slug === local)) ? local : null;
  const shown = (items ?? []).filter((it) => {
    if (!pick) return true;
    const d = divisionOf(it);
    if (pick === 'club') return !d;
    return !!d && dir.find((x) => x.id === d)?.slug === pick;
  });
  const choose = (v: string | null) => {
    setLocal(v);
    setParams({ scope: v });
  };
  const control =
    owners > 1 ? (
      <div className={styles.filter} role="group" aria-label="Show">
        <button type="button" aria-pressed={!pick} className={!pick ? styles.on : ''} onClick={() => choose(null)}>
          All
        </button>
        {present.club && (
          <button type="button" aria-pressed={pick === 'club'} className={pick === 'club' ? styles.on : ''} onClick={() => choose('club')}>
            Club
          </button>
        )}
        {present.divisions.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={pick === d.slug}
            className={pick === d.slug ? styles.on : ''}
            style={{ ['--dot' as string]: d.accent }}
            onClick={() => choose(d.slug)}
          >
            <i className={styles.dot} aria-hidden="true" /> {d.name}
          </button>
        ))}
      </div>
    ) : null;
  return { shown, control, pick };
}
