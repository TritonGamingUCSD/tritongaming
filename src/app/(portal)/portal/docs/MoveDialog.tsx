'use client';

import { useMemo, useState } from 'react';
import Dialog, { DialogActions, DialogCancel, DialogText } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { descendantIds, flatten, type DocSection } from '@/lib/docsTree';
import type { Doc } from '@/types/database';
import type { DropTarget } from './DocSidebar';
import styles from './docs.module.css';

// "Move to…": the same as dragging, for phones and keyboards. Pick the top of a category or the inside of another page.
export default function MoveDialog({ doc, docs, sections, onMove, onClose }: { doc: Doc; docs: Doc[]; sections: DocSection<Doc>[]; onMove: (t: DropTarget) => Promise<void>; onClose: () => void }) {
  const blocked = useMemo(() => new Set([doc.id, ...descendantIds(docs, doc.id)]), [docs, doc.id]);
  const [pick, setPick] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => sections.flatMap((s) => [
    { value: `cat:${s.id ?? ''}`, label: `${s.name}: top level`, depth: 0, target: { parentId: null, categoryId: s.id, beforeId: null } as DropTarget },
    ...s.nodes.flatMap(function walk(n): { value: string; label: string; depth: number; target: DropTarget }[] {
      if (blocked.has(n.doc.id)) return [];
      return [{ value: `doc:${n.doc.id}`, label: n.doc.title || 'Untitled', depth: n.depth + 1, target: { parentId: n.doc.id, categoryId: null, beforeId: null } }, ...n.children.flatMap(walk)];
    }),
  ]), [sections, blocked]);
  void flatten;
  const chosen = options.find((o) => o.value === pick);
  return (
    <Dialog title={`Move “${doc.title || 'Untitled'}”`} onClose={onClose} busy={busy}>
      <DialogText>Choose where this page should go. Pages inside it move with it.</DialogText>
      <div className={styles.moveList} role="listbox" aria-label="Destinations">
        {options.map((o) => (
          <button key={o.value} type="button" role="option" aria-selected={pick === o.value} className={`${styles.moveOpt} ${pick === o.value ? styles.moveOptOn : ''}`} style={{ paddingLeft: `${0.7 + o.depth * 0.9}rem` }} onClick={() => setPick(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      <DialogActions>
        <DialogCancel onClick={onClose} disabled={busy} />
        <Button size="sm" loading={busy} disabled={!chosen} onClick={async () => { if (!chosen) return; setBusy(true); await onMove(chosen.target); setBusy(false); }}>Move Here</Button>
      </DialogActions>
    </Dialog>
  );
}
