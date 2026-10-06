'use client';

import Button from '@/components/ui/Button';
import { GripVertical, Plus } from 'lucide-react';
import ArtRow from './ArtRow';
import { useDragReorder } from '@/lib/useDragReorder';
import { MAX_POSTERS, type AssetCredit } from '@/lib/eventTheme';
import type { CreditPerson } from '@/lib/creditPeople';
import styles from './eventextras.module.css';

// The event's posters in one list. The first is the main poster at the top of the event page and on event cards; with more than one, the page
// shows a small gallery in this order. At least one is required. Each one can be credited, with a link to the artist's portfolio or social page.
export default function EventPostersField({
  posters,
  credits,
  onChange,
  people = [],
}: {
  people?: CreditPerson[];
  posters: string[];
  credits: Record<string, AssetCredit>;
  onChange: (posters: string[], credits: Record<string, AssetCredit>) => void;
}) {
  const list = posters.length ? posters : [''];
  const { view, dragIndex, overIndex, dragHandleProps, dropTargetProps } = useDragReorder(list, (next) => onChange(next, credits));

  const setPoster = (i: number, url: string) => {
    const old = list[i];
    let next = credits;
    if (old && old !== url && credits[old]) {
      const { [old]: moved, ...rest } = credits;
      next = url ? { ...rest, [url]: moved } : rest;
    }
    onChange(url ? list.map((x, j) => (j === i ? url : x)) : list.filter((_, j) => j !== i), next);
  };
  const setCredit = (url: string, patch: Partial<AssetCredit>) => onChange(list, { ...credits, [url]: { ...(credits[url] ?? { name: '' }), ...patch } });

  return (
    <div className={styles.field}>
      <span className={`${styles.label} ${styles.cap}`}>Posters * (up to {MAX_POSTERS})</span>
      <span className={styles.hint}>At least one is required. Drag the grip to reorder; the first is the main poster. Click a thumbnail to replace it.</span>
      {view.map((u, i) => (
        <div
          key={i}
          className={`${styles.artRowWrap} ${dragIndex === i ? styles.dragging : ''} ${overIndex === i && dragIndex !== i ? styles.dragOver : ''}`}
          {...dropTargetProps(i)}
        >
          <ArtRow
            label={`Poster ${i + 1}`}
            extra={i === 0 ? 'Main poster' : undefined}
            value={u}
            onChange={(url) => setPoster(i, url)}
            shape="wide"
            maxDimension={2400}
            people={people}
            credit={credits[u]}
            onCredit={(patch) => setCredit(u, patch)}
            grip={<span className={styles.grip} {...dragHandleProps(i)} aria-label={`Drag to reorder poster ${i + 1}`}><GripVertical size={16} aria-hidden="true" /></span>}
            onRemoveEmpty={list.length > 1 ? () => onChange(list.filter((_, j) => j !== i), credits) : undefined}
          />
        </div>
      ))}
      {list.length < MAX_POSTERS && list[list.length - 1] !== '' && (
        <Button size="sm" variant="secondary" onClick={() => onChange([...list, ''], credits)}><Plus size={14} aria-hidden="true" /> Add another poster</Button>
      )}
    </div>
  );
}
